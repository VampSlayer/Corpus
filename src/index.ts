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

  const server = new Server(
    {
      name: 'corpus-mcp-server',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools: any[] = [
      {
        name: 'get_system_map',
        description:
          'Get the pre-generated service catalogue with dependencies and reverse-dependencies. Always call this first when exploring services.',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'search_docs',
        description: 'Lexical search over the aggregated document corpus.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search keyword or phrase' }
          },
          required: ['query']
        }
      },
      {
        name: 'read_doc',
        description:
          'Read the full markdown content of a document by its ID (returned by search_docs).',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Document ID' }
          },
          required: ['id']
        }
      },
      {
        name: 'search_code',
        description:
          'Keyword search across all organization repositories using GitHub Code Search.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Code search query' }
          },
          required: ['query']
        }
      },
      {
        name: 'read_file',
        description: 'Read the exact file contents from a repository at a given branch or commit.',
        inputSchema: {
          type: 'object',
          properties: {
            repo: { type: 'string', description: 'Repository name' },
            path: { type: 'string', description: 'File path inside repository' },
            ref: { type: 'string', description: 'Branch or commit SHA (optional)' }
          },
          required: ['repo', 'path']
        }
      }
    ];

    if (process.env.ENABLE_GAP_REPORTING === 'true') {
      tools.push({
        name: 'report_doc_gap',
        description: 'File a GitHub work item when documentation fails to answer a question.',
        inputSchema: {
          type: 'object',
          properties: {
            question: { type: 'string', description: 'The unanswered question' },
            context: { type: 'string', description: 'Additional context or findings' }
          },
          required: ['question']
        }
      });
    }

    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const { name, arguments: args } = request.params;
      let result: any;

      switch (name) {
        case 'get_system_map':
          result = getSystemMap();
          return { content: [{ type: 'text', text: result }] };
        case 'search_docs':
          result = searchDocs(args?.query as string);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        case 'read_doc':
          result = readDoc(args?.id as string);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        case 'search_code':
          result = await searchCode(args?.query as string);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        case 'read_file':
          result = await readFile(args?.repo as string, args?.path as string, args?.ref as string);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        case 'report_doc_gap':
          result = await reportDocGap(args?.question as string, args?.context as string);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (err: any) {
      return {
        content: [{ type: 'text', text: `Error: ${err.message}` }],
        isError: true
      };
    }
  });

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
