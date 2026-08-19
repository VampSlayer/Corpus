import fs from 'fs';
import path from 'path';
import MiniSearch from 'minisearch';
import 'dotenv/config';
import { getProvider } from './providers/index.js';
import { pipeline } from '@xenova/transformers';

const ENABLE_GAP_REPORTING = process.env.ENABLE_GAP_REPORTING === 'true';
const DOC_SEARCH_METHOD = process.env.DOC_SEARCH_METHOD || 'lexical';

const corpusDir = process.env.CORPUS_DIR || path.resolve(process.cwd(), 'corpus');
const manifestPath = path.join(corpusDir, 'manifest.json');
const systemMapPath = path.join(corpusDir, 'system-map.yaml');

let manifestCache: any = null;
let searchIndex: MiniSearch | null = null;
let chunkEmbeddings: Array<{
  id: string;
  repo: string;
  path: string;
  html_url: string;
  text: string;
  embedding: number[];
}> = [];
const docsMap: Record<string, any> = {};

let extractor: any = null;

export function _loadCorpusData(data: any) {
  manifestCache = data;
  chunkEmbeddings = [];

  for (const key in docsMap) delete docsMap[key];

  searchIndex = new MiniSearch({
    fields: ['title', 'content'], // fields to index for full-text search
    storeFields: ['id', 'repo', 'path', 'sha', 'html_url'] // fields to return with search results
  });

  const docsToIndex = [];
  let idCounter = 1;

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

      docsMap[docId] = docEntry;
      docsToIndex.push(docEntry);

      if (DOC_SEARCH_METHOD === 'semantic' && doc.chunks) {
        for (const chunk of doc.chunks) {
          chunkEmbeddings.push({
            id: docId,
            repo: repoName,
            path: doc.path,
            html_url: doc.html_url,
            text: chunk.text,
            embedding: chunk.embedding
          });
        }
      }
    }
  }

  if (DOC_SEARCH_METHOD !== 'semantic') {
    searchIndex.addAll(docsToIndex);
  }
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

function cosineSimilarity(vecA: number[], vecB: number[]) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function searchDocs(query: string) {
  if (Object.keys(docsMap).length === 0) loadCorpus();

  if (DOC_SEARCH_METHOD !== 'semantic') {
    const results = searchIndex!.search(query, { prefix: true, combineWith: 'AND' });
    return results.slice(0, 10).map((r) => {
      const doc = docsMap[r.id];
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

  // Semantic Search Flow
  if (!extractor) {
    extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }

  const out = await extractor(query, { pooling: 'mean', normalize: true });
  const queryEmbedding = Array.from(out.data) as number[];

  const results = [];
  for (const chunk of chunkEmbeddings) {
    const score = cosineSimilarity(queryEmbedding, chunk.embedding);
    results.push({ ...chunk, score });
  }

  results.sort((a, b) => b.score - a.score);

  const uniqueDocs: Record<string, any> = {};
  for (const r of results) {
    if (!uniqueDocs[r.id]) {
      uniqueDocs[r.id] = {
        id: r.id,
        repo: r.repo,
        path: r.path,
        score: r.score,
        html_url: r.html_url,
        excerpt: r.text.length > 200 ? r.text.substring(0, 200).replace(/\n/g, ' ') + '...' : r.text
      };
    }
    if (Object.keys(uniqueDocs).length >= 10) break;
  }

  return Object.values(uniqueDocs);
}

export function readDoc(id: string) {
  if (Object.keys(docsMap).length === 0) loadCorpus();
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
