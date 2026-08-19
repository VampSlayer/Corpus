import { VcsProvider, Repository, FileContent, SearchResult } from './types.js';

export class AzureDevOpsProvider implements VcsProvider {
  private apiBase: string;
  private organization: string;
  private project: string;
  private headers: Record<string, string>;

  constructor(org: string, token: string, project?: string) {
    if (!org || !token)
      throw new Error('AzureDevOpsProvider requires GIT_ORG (Organization) and GIT_PAT (PAT)');
    this.organization = org;
    this.project = project || '';
    this.apiBase = `https://dev.azure.com/${encodeURIComponent(org)}`;

    // Azure DevOps uses Basic Auth with an empty username and the PAT as the password
    this.headers = {
      Authorization: `Basic ${Buffer.from(`:${token}`).toString('base64')}`,
      'Content-Type': 'application/json'
    };
  }

  private async fetchJson(url: string, options: any = {}) {
    const res = await fetch(url, { headers: this.headers, ...options });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Azure DevOps API error: ${res.status} ${res.statusText} for ${url}`);
    }
    return res.json();
  }

  async getRepositories(): Promise<Repository[]> {
    // If project is defined, scope to project, else query org level (which returns all repos across projects)
    const scope = this.project ? `${encodeURIComponent(this.project)}/` : '';
    const url = `${this.apiBase}/${scope}_apis/git/repositories?api-version=7.0`;

    const data = await this.fetchJson(url);
    if (!data || !data.value) return [];

    return data.value.map((r: any) => ({
      name: r.name,
      defaultBranch: r.defaultBranch ? r.defaultBranch.replace('refs/heads/', '') : 'main',
      html_url: r.webUrl
    }));
  }

  async getFiles(
    repoName: string,
    branch: string,
    isMatch: (path: string) => boolean
  ): Promise<FileContent[]> {
    // Scope down to project if required, or we can just use repo name if it's unique
    const scope = this.project ? `${encodeURIComponent(this.project)}/` : '';
    const itemsUrl = `${this.apiBase}/${scope}_apis/git/repositories/${encodeURIComponent(repoName)}/items?recursionLevel=Full&versionDescriptor.version=${encodeURIComponent(branch)}&api-version=7.0`;

    const treeData = await this.fetchJson(itemsUrl);
    if (!treeData || !treeData.value) return [];

    const matchedFiles = treeData.value.filter(
      (item: any) => !item.isFolder && isMatch(item.path.replace(/^\//, ''))
    );
    const results: FileContent[] = [];

    for (const file of matchedFiles) {
      // Azure requires fetching the blob directly via its URL
      const contentRes = await fetch(file.url, { headers: this.headers });
      if (!contentRes.ok) continue;
      const content = await contentRes.text();

      // Trim leading slash for consistency
      const relativePath = file.path.replace(/^\//, '');

      results.push({
        path: relativePath,
        sha: file.objectId,
        content,
        html_url: `${this.apiBase}/${scope}_git/${repoName}?path=${encodeURIComponent(file.path)}&version=GB${encodeURIComponent(branch)}`
      });
    }

    return results;
  }

  async searchCode(query: string): Promise<SearchResult[]> {
    // Azure DevOps requires the ALM Search extension for this API
    const url = `https://almsearch.dev.azure.com/${encodeURIComponent(this.organization)}/_apis/search/codesearchresults?api-version=7.0`;

    const body = {
      searchText: query,
      $top: 10
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(
          'Azure DevOps Code Search extension is not installed or enabled for this organization.'
        );
      }
      throw new Error(`Azure DevOps Code Search API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    if (!data || !data.results) return [];

    return data.results.map((item: any) => ({
      repo: item.repository.name,
      path: item.path.replace(/^\//, ''),
      html_url: `${this.apiBase}/${encodeURIComponent(item.project.name)}/_git/${encodeURIComponent(item.repository.name)}?path=${encodeURIComponent(item.path)}`
    }));
  }

  async searchIssuesAndPRs(query: string): Promise<SearchResult[]> {
    throw new Error('Azure DevOps Work Item search not currently implemented in Corpus.');
  }

  async readFile(repo: string, filePath: string, ref?: string): Promise<FileContent> {
    const scope = this.project ? `${encodeURIComponent(this.project)}/` : '';
    const branch = ref || 'main';
    // Ensure path starts with slash for Azure
    const azurePath = filePath.startsWith('/') ? filePath : `/${filePath}`;

    const url = `${this.apiBase}/${scope}_apis/git/repositories/${encodeURIComponent(repo)}/items?path=${encodeURIComponent(azurePath)}&versionDescriptor.version=${encodeURIComponent(branch)}&api-version=7.0`;

    const contentRes = await fetch(url, { headers: this.headers });
    if (!contentRes.ok) throw new Error('File not found');
    const content = await contentRes.text();

    return {
      path: filePath,
      sha: branch,
      content,
      html_url: `${this.apiBase}/${scope}_git/${repo}?path=${encodeURIComponent(azurePath)}&version=GB${encodeURIComponent(branch)}`
    };
  }

  async reportDocGap(
    question: string,
    context?: string
  ): Promise<{ message: string; issue_url: string }> {
    if (!this.project)
      throw new Error(
        'AzureDevOpsProvider requires a GITHUB_PROJECT (which maps to Azure Project name) to create Work Items.'
      );

    const url = `${this.apiBase}/${encodeURIComponent(this.project)}/_apis/wit/workitems/$Task?api-version=7.0`;

    // JSON Patch format required for Azure Work Items
    const body = [
      {
        op: 'add',
        path: '/fields/System.Title',
        value: `Doc Gap: ${question.substring(0, 50)}...`
      },
      {
        op: 'add',
        path: '/fields/System.Description',
        value: `<h3>Unanswered Question</h3><p>${question}</p><h3>Context</h3><p>${context || 'None provided.'}</p><em>Auto-generated by Corpus MCP Server</em>`
      }
    ];

    const res = await fetch(url, {
      method: 'POST',
      headers: { ...this.headers, 'Content-Type': 'application/json-patch+json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error(`Failed to create Work Item: ${res.statusText}`);
    const data = await res.json();

    return { message: 'Work item created successfully.', issue_url: data._links.html.href };
  }
}
