import fs from 'fs';
import path from 'path';
import MiniSearch from 'minisearch';
import 'dotenv/config';
import { getProvider } from './providers/index.js';

const ENABLE_GAP_REPORTING = process.env.ENABLE_GAP_REPORTING === 'true';

const corpusDir = process.env.CORPUS_DIR || path.resolve(process.cwd(), 'corpus');
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

export function listApiSchemas() {
  if (!searchIndex) loadCorpus();
  const schemas = [];
  for (const doc of Object.values(docsMap)) {
    if (doc.path.match(/(openapi|swagger)\.(yaml|yml|json)$/i)) {
      schemas.push({
        id: doc.id,
        repo: doc.repo,
        path: doc.path,
        html_url: doc.html_url
      });
    }
  }
  return schemas;
}

export async function searchCode(query: string) {
  const provider = getProvider();
  return provider.searchCode(query);
}

export async function searchIssuesAndPRs(query: string) {
  const provider = getProvider();
  return provider.searchIssuesAndPRs(query);
}

export async function readFile(repo: string, filePath: string, ref?: string) {
  const provider = getProvider();
  return provider.readFile(repo, filePath, ref);
}

export async function reportDocGap(question: string, context?: string) {
  if (!ENABLE_GAP_REPORTING) {
    throw new Error('Gap reporting is disabled.');
  }
  const provider = getProvider();
  return provider.reportDocGap(question, context);
}
