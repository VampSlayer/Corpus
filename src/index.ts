import { createServerApp } from './server.js';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import 'dotenv/config';

import {
  getSystemMap,
  searchDocs,
  readDoc,
  searchCode,
  readFile,
  reportDocGap,
  loadCorpus
} from './tools.js';

const GIT_ORG = process.env.GIT_ORG;
const GIT_PAT = process.env.GIT_PAT;

const corpusDir = path.resolve(process.cwd(), 'corpus');
const manifestPath = path.join(corpusDir, 'manifest.json');
const systemMapPath = path.join(corpusDir, 'system-map.yaml');

function runBuild(scriptName: string) {
  console.error(`Running build:${scriptName}...`);
  const result = spawnSync('npm', ['run', `build:${scriptName}`], {
    stdio: 'inherit',
    shell: true
  });
  if (result.status !== 0) {
    console.error(`Build ${scriptName} failed.`);
    process.exit(1);
  }
}

function ensureCorpus() {
  let hasManifest = fs.existsSync(manifestPath);
  const hasMap = fs.existsSync(systemMapPath);

  if (!hasManifest) {
    if (!GIT_ORG || !GIT_PAT) {
      console.error(
        'Error: Missing corpus/manifest.json and no GIT_ORG/GIT_PAT provided to build it.'
      );
      console.error('Please configure your credentials or build the corpus manually.');
      process.exit(1);
    }
    runBuild('corpus');
    hasManifest = true;
  }

  if (hasManifest && !hasMap) {
    runBuild('map');
  }
}

async function main() {
  ensureCorpus();

  try {
    loadCorpus();
  } catch (e) {
    console.error('Failed to load corpus into memory:', e);
    process.exit(1);
  }

  const server = createServerApp();

  // Start HTTP server for future use
  const app = express();
  app.get('/health', (req, res) => res.send('OK'));
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.error(`HTTP transport available on port ${port} (unused)`);
  });

  // Start stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Corpus MCP Server running on stdio');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
