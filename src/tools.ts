import fs from 'fs';
import path from 'path';
import MiniSearch from 'minisearch';
import 'dotenv/config';

const GIT_ORG = process.env.GIT_ORG;
const GIT_PAT = process.env.GIT_PAT;
const GITHUB_PROJECT = process.env.GITHUB_PROJECT;
const ENABLE_GAP_REPORTING = process.env.ENABLE_GAP_REPORTING === 'true';

const API_BASE = 'https://api.github.com';
const headers = {
  Accept: 'application/vnd.github.v3+json',
  Authorization: `Bearer ${GIT_PAT}`,
  'User-Agent': 'Corpus-MCP-Server'
};

const corpusDir = path.resolve(process.cwd(), 'corpus');
const manifestPath = path.join(corpusDir, 'manifest.json');
const systemMapPath = path.join(corpusDir, 'system-map.yaml');

let manifestCache: any = null;
let searchIndex: MiniSearch | null = null;
const docsMap: Record<string, any> = {};

export function _loadCorpusData(data: any) {
  manifestCache = data;

  searchIndex = new MiniSearch({
    fields: ['title', 'content'], // fields to index for full-text search
    storeFields: ['id', 'repo', 'path', 'sha', 'html_url'] // fields to return with search results
  });

  const docsToIndex = [];
  let idCounter = 1;

  // Clear docsMap for tests
  for (const key in docsMap) delete docsMap[key];

  for (const [repoName, repoData] of Object.entries(manifestCache.repos)) {
    for (const doc of (repoData as any).docs) {
      const docId = `doc_${idCounter++}`;
      const docEntry = {
        id: docId,
        repo: repoName,
        path: doc.path,
        sha: doc.sha,
        content: doc.content,
        html_url: doc.html_url,
        title: `${repoName} - ${doc.path}`
      };
      docsToIndex.push(docEntry);
      docsMap[docId] = docEntry;
    }
  }

  searchIndex.addAll(docsToIndex);
}

export function loadCorpus() {
  if (!fs.existsSync(manifestPath)) {
    throw new Error('manifest.json not found. Run build:corpus first.');
  }
  const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  _loadCorpusData(manifestData);
}

export function getSystemMap() {
  if (!fs.existsSync(systemMapPath)) {
    throw new Error('system-map.yaml not found. Run build:map first.');
  }
  return fs.readFileSync(systemMapPath, 'utf8');
}

export function searchDocs(query: string) {
  if (!searchIndex) loadCorpus();
  const results = searchIndex!.search(query, { prefix: true, combineWith: 'AND' });
  // Return top 10 results with excerpts
  return results.slice(0, 10).map((r) => {
    const doc = docsMap[r.id];
    // Simple excerpt generation (first 200 chars or index of match)
    const excerpt = doc.content.substring(0, 200).replace(/\n/g, ' ') + '...';
    return {
      id: r.id,
      repo: r.repo,
      path: r.path,
      score: r.score,
      html_url: r.html_url,
      excerpt
    };
  });
}

export function readDoc(id: string) {
  if (!searchIndex) loadCorpus();
  const doc = docsMap[id];
  if (!doc) {
    throw new Error(`Document with ID ${id} not found.`);
  }
  return {
    repo: doc.repo,
    path: doc.path,
    sha: doc.sha,
    html_url: doc.html_url,
    content: doc.content
  };
}

let accountType: string | null = null;

export async function searchCode(query: string) {
  if (!GIT_ORG || !GIT_PAT) throw new Error('GIT_ORG and GIT_PAT required.');

  if (!accountType) {
    const res = await fetch(`${API_BASE}/users/${GIT_ORG}`, { headers });
    if (res.ok) {
      const data = await res.json();
      accountType = data.type === 'User' ? 'user' : 'org';
    } else {
      accountType = 'org'; // fallback
    }
  }

  const q = encodeURIComponent(`${query} ${accountType}:${GIT_ORG}`);
  const url = `${API_BASE}/search/code?q=${q}&per_page=10`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`GitHub Code Search failed: ${res.statusText}`);
  }

  const data = await res.json();
  return data.items.map((item: any) => ({
    repo: item.repository.name,
    path: item.path,
    html_url: item.html_url,
    sha: item.sha
  }));
}

export async function readFile(repo: string, filePath: string, ref?: string) {
  if (!GIT_ORG || !GIT_PAT) throw new Error('GIT_ORG and GIT_PAT required.');

  let url = `${API_BASE}/repos/${GIT_ORG}/${repo}/contents/${filePath}`;
  if (ref) {
    url += `?ref=${encodeURIComponent(ref)}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`GitHub File fetch failed: ${res.statusText}`);
  }

  const data = await res.json();
  if (Array.isArray(data)) {
    throw new Error('Path is a directory, not a file.');
  }

  const content = Buffer.from(data.content, 'base64').toString('utf8');
  return {
    repo,
    path: data.path,
    sha: data.sha,
    html_url: data.html_url,
    content
  };
}

export async function reportDocGap(question: string, context?: string) {
  if (!ENABLE_GAP_REPORTING) {
    throw new Error('Gap reporting is disabled.');
  }
  if (!GIT_ORG || !GIT_PAT || !GITHUB_PROJECT) {
    throw new Error('GIT_ORG, GIT_PAT, and GITHUB_PROJECT required for reporting.');
  }

  // Here we would create an issue in a central repository or project.
  // We'll simulate creating an issue on the GITHUB_PROJECT repo.
  const repo = GITHUB_PROJECT.includes('/') ? GITHUB_PROJECT : `${GIT_ORG}/${GITHUB_PROJECT}`;

  const url = `${API_BASE}/repos/${repo}/issues`;
  const body = {
    title: `Doc Gap: ${question.substring(0, 50)}...`,
    body: `### Unanswered Question\n${question}\n\n### Context\n${context || 'None provided.'}\n\n_Auto-generated by Corpus MCP Server_`,
    labels: ['documentation', 'doc-gap']
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    throw new Error(`Failed to create issue: ${res.statusText}`);
  }

  const data = await res.json();
  return {
    message: 'Work item created successfully.',
    issue_url: data.html_url
  };
}
