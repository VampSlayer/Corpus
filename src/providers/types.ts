export interface Repository {
  name: string;
  defaultBranch: string;
  html_url: string;
}

export interface FileContent {
  path: string;
  sha: string;
  content: string; // raw utf8 content
  html_url: string;
}

export interface SearchResult {
  repo: string;
  path?: string;
  html_url: string;
  sha?: string;
  title?: string;
  state?: string;
  is_pr?: boolean;
  body_excerpt?: string;
}

export interface VcsProvider {
  /**
   * Return a list of all repositories accessible by the configured org/user
   */
  getRepositories(): Promise<Repository[]>;

  /**
   * Fetch matching files from a specific repository
   */
  getFiles(
    repoName: string,
    branch: string,
    isMatch: (path: string) => boolean
  ): Promise<FileContent[]>;

  /**
   * Global code search across the platform
   */
  searchCode(query: string): Promise<SearchResult[]>;

  /**
   * Global issue/PR search across the platform
   */
  searchIssuesAndPRs(query: string): Promise<SearchResult[]>;

  /**
   * Read the exact contents of a single file
   */
  readFile(repo: string, filePath: string, ref?: string): Promise<FileContent>;

  /**
   * File an issue on the remote platform
   */
  reportDocGap(question: string, context?: string): Promise<{ message: string; issue_url: string }>;
}
