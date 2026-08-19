import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import { isDocPath } from '../src/logic.js';

const GIT_ORG = process.env.GIT_ORG;
const GIT_PAT = process.env.GIT_PAT;

if (!GIT_ORG || !GIT_PAT) {
  console.error('Error: GIT_ORG and GIT_PAT environment variables are required.');
  process.exit(1);
}

const API_BASE = 'https://api.github.com';

const headers = {
  Accept: 'application/vnd.github.v3+json',
  Authorization: `Bearer ${GIT_PAT}`,
  'User-Agent': 'Corpus-MCP-Server'
};

async function fetchJson(url: string) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`GitHub API error: ${response.status} ${response.statusText} for ${url}`);
  }
  return response.json();
}

async function buildCorpus() {
  console.log(`Checking account type for: ${GIT_ORG}...`);
  const accountInfo = await fetchJson(`${API_BASE}/users/${GIT_ORG}`);
  const isUser = accountInfo && accountInfo.type === 'User';

  console.log(`Fetching repositories for ${isUser ? 'user' : 'org'}: ${GIT_ORG}...`);
  let repos: any[] = [];
  let page = 1;
  while (true) {
    const endpoint = isUser ? `user/repos?affiliation=owner` : `orgs/${GIT_ORG}/repos?`;
    const url = `${API_BASE}/${endpoint}${isUser ? '&' : ''}per_page=100&page=${page}`;
    const pageRepos = await fetchJson(url);
    if (!pageRepos || pageRepos.length === 0) break;
    // Filter to just the requested owner in case of user repos
    const filtered = pageRepos.filter(
      (r: any) => r.owner.login.toLowerCase() === GIT_ORG.toLowerCase()
    );
    repos = repos.concat(filtered);
    page++;
  }

  console.log(`Found ${repos.length} repositories. Processing...`);

  const manifest: any = {
    updatedAt: new Date().toISOString(),
    repos: {}
  };

  for (const repo of repos) {
    if (repo.archived) continue;
    const repoName = repo.name;
    const defaultBranch = repo.default_branch;
    console.log(`Processing ${repoName}...`);

    const treeUrl = `${API_BASE}/repos/${GIT_ORG}/${repoName}/git/trees/${defaultBranch}?recursive=1`;
    const treeData = await fetchJson(treeUrl);
    if (!treeData || !treeData.tree || treeData.truncated) {
      console.warn(`Could not fetch full tree for ${repoName}`);
      continue;
    }

    const matchedFiles = treeData.tree.filter(
      (item: any) => item.type === 'blob' && isDocPath(item.path)
    );

    const repoData: any = {
      name: repoName,
      html_url: repo.html_url,
      catalogInfo: null,
      docs: []
    };

    for (const file of matchedFiles) {
      const blobUrl = `${API_BASE}/repos/${GIT_ORG}/${repoName}/git/blobs/${file.sha}`;
      const blobData = await fetchJson(blobUrl);
      if (!blobData) continue;

      const content = Buffer.from(blobData.content, 'base64').toString('utf8');

      if (file.path === 'catalog-info.yaml') {
        repoData.catalogInfo = content;
      } else {
        repoData.docs.push({
          path: file.path,
          sha: file.sha,
          content,
          html_url: `${repo.html_url}/blob/${defaultBranch}/${file.path}`
        });
      }
    }

    manifest.repos[repoName] = repoData;
  }

  const outDir = path.resolve(process.cwd(), 'corpus');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const manifestPath = path.join(outDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Corpus built successfully at ${manifestPath}`);
}

buildCorpus().catch((err) => {
  console.error('Build corpus failed:', err);
  process.exit(1);
});
