import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import { isDocPath } from '../src/logic.js';
import { getProvider } from '../src/providers/index.js';

async function buildCorpus() {
  const provider = getProvider();

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
        repoData.docs.push({
          path: file.path,
          sha: file.sha,
          content: file.content,
          html_url: file.html_url
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
