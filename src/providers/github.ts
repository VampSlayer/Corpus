import { VcsProvider, Repository, FileContent, SearchResult } from './types.js';

export class GitHubProvider implements VcsProvider {
  private apiBase = 'https://api.github.com';
  private org: string;
  private headers: Record<string, string>;
  private accountType: string | null = null;
  private gapProject: string | undefined;

  constructor(org: string, pat: string, gapProject?: string) {
    if (!org || !pat) throw new Error('GitHubProvider requires org and pat');
    this.org = org;
    this.gapProject = gapProject;
    this.headers = {
      Accept: 'application/vnd.github.v3+json',
      Authorization: `Bearer ${pat}`,
      'User-Agent': 'Corpus-MCP-Server'
    };
  }

  private async fetchJson(url: string, options: any = {}) {
    const res = await fetch(url, { headers: this.headers, ...options });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`GitHub API error: ${res.status} ${res.statusText} for ${url}`);
    }
    return res.json();
  }

  private async ensureAccountType() {
    if (this.accountType) return this.accountType;
    const accountInfo = await this.fetchJson(`${this.apiBase}/users/${this.org}`);
    this.accountType = accountInfo && accountInfo.type === 'User' ? 'user' : 'org';
    return this.accountType;
  }

  async getRepositories(): Promise<Repository[]> {
    const type = await this.ensureAccountType();
    const isUser = type === 'user';
    let repos: any[] = [];
    let page = 1;

    while (true) {
      const endpoint = isUser ? `user/repos?affiliation=owner` : `orgs/${this.org}/repos?`;
      const url = `${this.apiBase}/${endpoint}${isUser ? '&' : ''}per_page=100&page=${page}`;
      const pageRepos = await this.fetchJson(url);

      if (!pageRepos || pageRepos.length === 0) break;

      const filtered = pageRepos.filter(
        (r: any) => r.owner.login.toLowerCase() === this.org.toLowerCase() && !r.archived
      );
      repos = repos.concat(filtered);
      page++;
    }

    return repos.map((r) => ({
      name: r.name,
      defaultBranch: r.default_branch,
      html_url: r.html_url
    }));
  }

  async getFiles(
    repoName: string,
    branch: string,
    isMatch: (path: string) => boolean
  ): Promise<FileContent[]> {
    const treeUrl = `${this.apiBase}/repos/${this.org}/${repoName}/git/trees/${branch}?recursive=1`;
    const treeData = await this.fetchJson(treeUrl);

    if (!treeData || !treeData.tree || treeData.truncated) {
      console.warn(`Could not fetch full tree for ${repoName}`);
      return [];
    }

    const matchedFiles = treeData.tree.filter(
      (item: any) => item.type === 'blob' && isMatch(item.path)
    );
    const results: FileContent[] = [];

    for (const file of matchedFiles) {
      const blobUrl = `${this.apiBase}/repos/${this.org}/${repoName}/git/blobs/${file.sha}`;
      const blobData = await this.fetchJson(blobUrl);
      if (!blobData) continue;

      const content = Buffer.from(blobData.content, 'base64').toString('utf8');
      results.push({
        path: file.path,
        sha: file.sha,
        content,
        html_url: `https://github.com/${this.org}/${repoName}/blob/${branch}/${file.path}`
      });
    }

    return results;
  }

  async searchCode(query: string): Promise<SearchResult[]> {
    const type = await this.ensureAccountType();
    const q = encodeURIComponent(`${query} ${type}:${this.org}`);
    const url = `${this.apiBase}/search/code?q=${q}&per_page=10`;

    const data = await this.fetchJson(url);
    if (!data || !data.items) return [];

    return data.items.map((item: any) => ({
      repo: item.repository.name,
      path: item.path,
      html_url: item.html_url,
      sha: item.sha
    }));
  }

  async searchIssuesAndPRs(query: string): Promise<SearchResult[]> {
    const type = await this.ensureAccountType();
    const q = encodeURIComponent(`${query} ${type}:${this.org}`);
    const url = `${this.apiBase}/search/issues?q=${q}&per_page=10`;

    const data = await this.fetchJson(url);
    if (!data || !data.items) return [];

    return data.items.map((item: any) => ({
      repo: item.repository_url.split('/').slice(-1)[0],
      title: item.title,
      state: item.state,
      html_url: item.html_url,
      is_pr: !!item.pull_request,
      body_excerpt: item.body ? item.body.substring(0, 200).replace(/\n/g, ' ') + '...' : ''
    }));
  }

  async readFile(repo: string, filePath: string, ref?: string): Promise<FileContent> {
    let url = `${this.apiBase}/repos/${this.org}/${repo}/contents/${filePath}`;
    if (ref) {
      url += `?ref=${encodeURIComponent(ref)}`;
    }

    const data = await this.fetchJson(url);
    if (!data) throw new Error('File not found');
    if (Array.isArray(data)) throw new Error('Path is a directory, not a file');

    return {
      path: data.path,
      sha: data.sha,
      content: Buffer.from(data.content, 'base64').toString('utf8'),
      html_url: data.html_url
    };
  }

  async reportDocGap(
    question: string,
    context?: string
  ): Promise<{ message: string; issue_url: string }> {
    if (!this.gapProject) throw new Error('GITHUB_PROJECT must be set to report gaps');

    const repo = this.gapProject.includes('/') ? this.gapProject : `${this.org}/${this.gapProject}`;
    const url = `${this.apiBase}/repos/${repo}/issues`;

    const body = {
      title: `Doc Gap: ${question.substring(0, 50)}...`,
      body: `### Unanswered Question\n${question}\n\n### Context\n${context || 'None provided.'}\n\n_Auto-generated by Corpus MCP Server_`,
      labels: ['documentation', 'doc-gap']
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { ...this.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error(`Failed to create issue: ${res.statusText}`);
    const data = await res.json();

    return { message: 'Work item created successfully.', issue_url: data.html_url };
  }
}
