import test from 'node:test';
import assert from 'node:assert/strict';
import { _loadCorpusData, searchDocs, readDoc, listApiSchemas } from '../src/tools.js';

test('Corpus Search Tools', async (t) => {
  // Test fixture setup
  const mockManifest = {
    updatedAt: new Date().toISOString(),
    repos: {
      'test-repo': {
        name: 'test-repo',
        docs: [
          {
            path: 'docs/architecture.md',
            sha: '123',
            content: 'The core architecture uses microservices and a message bus.',
            html_url: 'https://github.com/org/test-repo/blob/main/docs/architecture.md'
          },
          {
            path: 'README.md',
            sha: '456',
            content: 'Welcome to the test repository. We build fast software.',
            html_url: 'https://github.com/org/test-repo/blob/main/README.md'
          },
          {
            path: 'openapi.yaml',
            sha: '789',
            content: 'openapi: 3.0.0\ninfo:\n  title: Test API',
            html_url: 'https://github.com/org/test-repo/blob/main/openapi.yaml'
          }
        ]
      }
    }
  };

  // Load the test data into memory
  _loadCorpusData(mockManifest);

  await t.test('searchDocs finds relevant documents', async () => {
    const results = await searchDocs('microservices');
    assert.equal(results.length, 1);
    assert.equal(results[0].path, 'docs/architecture.md');
    assert.equal(results[0].repo, 'test-repo');
    assert.ok(results[0].excerpt.includes('microservices'));
  });

  await t.test('searchDocs returns empty array for no match', async () => {
    const results = await searchDocs('kubernetes');
    assert.equal(results.length, 0);
  });

  await t.test('readDoc returns full content for valid ID', async () => {
    const results = await searchDocs('software');
    assert.equal(results.length, 1);

    const docId = results[0].id;
    const doc = readDoc(docId);

    assert.equal(doc.path, 'README.md');
    assert.equal(doc.content, 'Welcome to the test repository. We build fast software.');
  });

  await t.test('readDoc throws on invalid ID', () => {
    assert.throws(() => {
      readDoc('invalid_id_999');
    }, /Document with ID invalid_id_999 not found/);
  });

  await t.test('listApiSchemas returns only API schema files', () => {
    const schemas = listApiSchemas();
    assert.equal(schemas.length, 1);
    assert.equal(schemas[0].path, 'openapi.yaml');
    assert.equal(schemas[0].repo, 'test-repo');
  });

  await t.test('searchDocs executes semantic search when configured', async () => {
    process.env.DOC_SEARCH_METHOD = 'semantic';
    // Manually push a chunk to the mock so it has something to embed
    (mockManifest.repos['test-repo'].docs[0] as any).chunks = [
      {
        text: 'The core architecture uses microservices and a message bus.',
        embedding: Array(384).fill(0.1)
      }
    ];
    _loadCorpusData(mockManifest);

    const results = await searchDocs('architecture');
    assert.ok(Array.isArray(results));

    // Reset env
    delete process.env.DOC_SEARCH_METHOD;
    _loadCorpusData(mockManifest);
  });
});

import { createServerApp } from '../src/server.js';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

test('MCP Server Interface', async (t) => {
  const server = createServerApp();

  await t.test('Server initializes correctly', () => {
    assert.ok(server);
  });
});
