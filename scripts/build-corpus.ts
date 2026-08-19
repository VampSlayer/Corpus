import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import { isDocPath } from '../src/logic.js';
import { getProvider } from '../src/providers/index.js';
import { pipeline } from '@xenova/transformers';

function chunkText(text: string, maxChars = 1000) {
  const paragraphs = text.split('\n\n');
  const chunks = [];
  let currentChunk = '';
  for (const p of paragraphs) {
    if (currentChunk.length + p.length > maxChars && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }
    currentChunk += p + '\n\n';
  }
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  return chunks;
}

async function buildCorpus() {
  const provider = getProvider();

  const useSemantic = process.env.DOC_SEARCH_METHOD === 'semantic';

  let extractor: any = null;
  if (useSemantic) {
    console.log('Loading embedding model for semantic search...');
    extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }

  console.log(`Fetching repositories...`);
  const repos = await provider.getRepositories();
  console.log(`Found ${repos.length} repositories. Processing...`);

  const manifest: any = {
    updatedAt: new Date().toISOString(),
    repos: {}
  };

  for (const repo of repos) {
    const repoName = repo.name;
    console.log(`Processing ${repoName}...`);

    const repoData: any = {
      name: repoName,
      html_url: repo.html_url,
      catalogInfo: null,
      docs: []
    };

    const files = await provider.getFiles(repoName, repo.defaultBranch, isDocPath);

    for (const file of files) {
      if (file.path === 'catalog-info.yaml') {
        repoData.catalogInfo = file.content;
      } else {
        const textChunks = chunkText(file.content);
        const embeddedChunks = [];

        if (useSemantic) {
          for (const chunk of textChunks) {
            if (!chunk) continue;
            try {
              const out = await extractor(chunk, { pooling: 'mean', normalize: true });
              embeddedChunks.push({
                text: chunk,
                embedding: Array.from(out.data)
              });
            } catch (e) {
              console.error(`Error embedding chunk in ${file.path}:`, e);
            }
          }
        }

        repoData.docs.push({
          path: file.path,
          sha: file.sha,
          content: file.content,
          html_url: file.html_url,
          chunks: embeddedChunks
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
  fs.writeFileSync(manifestPath, JSON.stringify(manifest)); // omit null, 2 to save massive space
  console.log(`Corpus built successfully at ${manifestPath}`);
}

buildCorpus().catch((err) => {
  console.error('Build corpus failed:', err);
  process.exit(1);
});
