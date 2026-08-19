import { VcsProvider, Repository, FileContent, SearchResult } from './types.js';

export class BitbucketProvider implements VcsProvider {
  private apiBase = 'https://api.bitbucket.org/2.0';
  private workspace: string;
  private headers: Record<string, string>;

  constructor(workspace: string, token: string) {
    if (!workspace || !token)
      throw new Error('BitbucketProvider requires GIT_ORG (workspace) and GIT_PAT (App Password)');
    this.workspace = workspace;

    // Bitbucket uses Basic Auth for App Passwords (username:password) or Bearer for OAuth
    const authHeader = token.includes(':')
      ? `Basic ${Buffer.from(token).toString('base64')}`
      : `Bearer ${token}`;

    this.headers = {
      Authorization: authHeader,
      'Content-Type': 'application/json'
    };
  }

  private async fetchJson(url: string) {
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Bitbucket API error: ${res.status} ${res.statusText} for ${url}`);
    }
    return res.json();
  }

  async getRepositories(): Promise<Repository[]> {
    let repos: any[] = [];
    let url = `${this.apiBase}/repositories/${encodeURIComponent(this.workspace)}?pagelen=100`;

    while (url) {
      const data = await this.fetchJson(url);
      if (!data || !data.values) break;
      repos = repos.concat(data.values);
      url = data.next; // Bitbucket handles pagination with absolute next URLs
    }

    return repos.map((r) => ({
      name: r.slug,
      defaultBranch: r.mainbranch?.name || 'main',
      html_url: r.links?.html?.href || `https://bitbucket.org/${this.workspace}/${r.slug}`
    }));
  }

  async getFiles(
    repoName: string,
    branch: string,
    isMatch: (path: string) => boolean
  ): Promise<FileContent[]> {
    const results: FileContent[] = [];
    // max_depth=10 returns a flat list of all nested items up to depth 10
    let url = `${this.apiBase}/repositories/${encodeURIComponent(this.workspace)}/${encodeURIComponent(repoName)}/src/${encodeURIComponent(branch)}/?max_depth=10&pagelen=100`;

    let files: any[] = [];
    while (url) {
      const data = await this.fetchJson(url);
      if (!data || !data.values) break;
      files = files.concat(data.values);
      url = data.next;
    }

    const matchedFiles = files.filter((f) => f.type === 'commit_file' && isMatch(f.path));

    for (const file of matchedFiles) {
      const contentRes = await fetch(file.links.self.href, { headers: this.headers });
      if (!contentRes.ok) continue;
      const content = await contentRes.text();

      results.push({
        path: file.path,
        sha: file.commit?.hash || branch,
        content,
        html_url:
          file.links?.html?.href ||
          `https://bitbucket.org/${this.workspace}/${repoName}/src/${branch}/${file.path}`
      });
    }

    return results;
  }

  async searchCode(query: string): Promise<SearchResult[]> {
    const url = `${this.apiBase}/workspaces/${encodeURIComponent(this.workspace)}/search/code?search_query=${encodeURIComponent(query)}`;
    const data = await this.fetchJson(url);
    if (!data || !data.values) return [];

    return data.values.slice(0, 10).map((item: any) => ({
      repo: item.file.commit.repository.slug,
      path: item.file.path,
      html_url: item.file.links?.html?.href || ''
    }));
  }

  async searchIssuesAndPRs(query: string): Promise<SearchResult[]> {
    throw new Error('Bitbucket global issue search not supported by default API.');
  }

  async readFile(repo: string, filePath: string, ref?: string): Promise<FileContent> {
    const branch = ref || 'main';
    const url = `${this.apiBase}/repositories/${encodeURIComponent(this.workspace)}/${encodeURIComponent(repo)}/src/${encodeURIComponent(branch)}/${encodeURIComponent(filePath)}`;

    const contentRes = await fetch(url, { headers: this.headers });
    if (!contentRes.ok) throw new Error('File not found');
    const content = await contentRes.text();

    return {
      path: filePath,
      sha: branch,
      content,
      html_url: `https://bitbucket.org/${this.workspace}/${repo}/src/${branch}/${filePath}`
    };
  }

  async reportDocGap(
    question: string,
    context?: string
  ): Promise<{ message: string; issue_url: string }> {
    throw new Error('Bitbucket issue reporting not currently supported out of the box.');
  }
}
