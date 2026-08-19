import { VcsProvider, Repository, FileContent, SearchResult } from './types.js';

export class GitLabProvider implements VcsProvider {
  private apiBase: string;
  private token: string;
  private group: string | undefined;
  private headers: Record<string, string>;
  private gapProject: string | undefined;

  constructor(token: string, group?: string, gapProject?: string, url = 'https://gitlab.com') {
    if (!token) throw new Error('GitLabProvider requires GIT_PAT (token)');
    this.apiBase = url.replace(/\/$/, '') + '/api/v4';
    this.token = token;
    this.group = group;
    this.gapProject = gapProject;
    this.headers = {
      'PRIVATE-TOKEN': token,
      'Content-Type': 'application/json'
    };
  }

  private async fetchJson(url: string, options: any = {}) {
    const res = await fetch(url, { headers: this.headers, ...options });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`GitLab API error: ${res.status} ${res.statusText} for ${url}`);
    }
    return res.json();
  }

  async getRepositories(): Promise<Repository[]> {
    let repos: any[] = [];
    let page = 1;

    while (true) {
      const endpoint = this.group
        ? `groups/${encodeURIComponent(this.group)}/projects`
        : `projects?membership=true`;
      const url = `${this.apiBase}/${endpoint}${this.group ? '?' : '&'}per_page=100&page=${page}`;

      const pageRepos = await this.fetchJson(url);
      if (!pageRepos || pageRepos.length === 0) break;

      const filtered = pageRepos.filter((r: any) => !r.archived);
      repos = repos.concat(filtered);
      page++;
    }

    return repos.map((r) => ({
      name: r.path_with_namespace, // e.g. group/project
      defaultBranch: r.default_branch || 'main',
      html_url: r.web_url
    }));
  }

  async getFiles(
    repoName: string,
    branch: string,
    isMatch: (path: string) => boolean
  ): Promise<FileContent[]> {
    const encRepo = encodeURIComponent(repoName);
    let tree: any[] = [];
    let page = 1;

    while (true) {
      const treeUrl = `${this.apiBase}/projects/${encRepo}/repository/tree?ref=${branch}&recursive=true&per_page=100&page=${page}`;
      const treePage = await this.fetchJson(treeUrl);
      if (!treePage || treePage.length === 0) break;
      tree = tree.concat(treePage);
      page++;
    }

    const matchedFiles = tree.filter((item: any) => item.type === 'blob' && isMatch(item.path));
    const results: FileContent[] = [];

    for (const file of matchedFiles) {
      const encPath = encodeURIComponent(file.path);
      const blobUrl = `${this.apiBase}/projects/${encRepo}/repository/files/${encPath}?ref=${branch}`;
      const blobData = await this.fetchJson(blobUrl);
      if (!blobData) continue;

      const content = Buffer.from(blobData.content, 'base64').toString('utf8');
      results.push({
        path: file.path,
        sha: blobData.commit_id,
        content,
        html_url:
          blobData.web_url ||
          `${this.apiBase.replace('/api/v4', '')}/${repoName}/-/blob/${branch}/${file.path}`
      });
    }

    return results;
  }

  async searchCode(query: string): Promise<SearchResult[]> {
    const scope = this.group ? `groups/${encodeURIComponent(this.group)}` : '';
    const endpoint = scope ? `${scope}/search` : `search`;
    const url = `${this.apiBase}/${endpoint}?scope=blobs&search=${encodeURIComponent(query)}`;

    const data = await this.fetchJson(url);
    if (!data || !Array.isArray(data)) return [];

    return data.slice(0, 10).map((item: any) => ({
      repo: item.project_id.toString(),
      path: item.path,
      html_url: `${this.apiBase.replace('/api/v4', '')}/${item.project_id}/-/blob/${item.ref}/${item.path}`
    }));
  }

  async searchIssuesAndPRs(query: string): Promise<SearchResult[]> {
    const scope = this.group ? `groups/${encodeURIComponent(this.group)}` : '';
    const endpoint = scope ? `${scope}/search` : `search`;
    const url = `${this.apiBase}/${endpoint}?scope=issues&search=${encodeURIComponent(query)}`;

    const data = await this.fetchJson(url);
    if (!data || !Array.isArray(data)) return [];

    return data.slice(0, 10).map((item: any) => ({
      repo: item.project_id.toString(),
      title: item.title,
      state: item.state,
      html_url: item.web_url,
      is_pr: false,
      body_excerpt: item.description ? item.description.substring(0, 200) + '...' : ''
    }));
  }

  async readFile(repo: string, filePath: string, ref?: string): Promise<FileContent> {
    const encRepo = encodeURIComponent(repo);
    const encPath = encodeURIComponent(filePath);
    const branch = ref || 'main';

    const url = `${this.apiBase}/projects/${encRepo}/repository/files/${encPath}?ref=${branch}`;
    const data = await this.fetchJson(url);

    if (!data) throw new Error('File not found');

    return {
      path: data.file_path,
      sha: data.commit_id,
      content: Buffer.from(data.content, 'base64').toString('utf8'),
      html_url: data.web_url
    };
  }

  async reportDocGap(
    question: string,
    context?: string
  ): Promise<{ message: string; issue_url: string }> {
    if (!this.gapProject)
      throw new Error('GITHUB_PROJECT (Project ID) must be set for GitLab gap reporting');

    const encRepo = encodeURIComponent(this.gapProject);
    const url = `${this.apiBase}/projects/${encRepo}/issues`;

    const body = {
      title: `Doc Gap: ${question.substring(0, 50)}...`,
      description: `### Unanswered Question\n${question}\n\n### Context\n${context || 'None provided.'}\n\n_Auto-generated by Corpus MCP Server_`,
      labels: 'documentation,doc-gap'
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error(`Failed to create issue: ${res.statusText}`);
    const data = await res.json();

    return { message: 'Work item created successfully.', issue_url: data.web_url };
  }
}
