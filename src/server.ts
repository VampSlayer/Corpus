import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import {
  getSystemMap,
  searchDocs,
  readDoc,
  searchCode,
  readFile,
  reportDocGap,
  listApiSchemas,
  searchIssuesAndPRs,
  listCompanySkills
} from './tools.js';

export function createServerApp() {
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
      },
      {
        name: 'list_api_schemas',
        description: 'List all OpenAPI / Swagger schemas found across the organization.',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'list_company_skills',
        description:
          'List all AI skills found across the organization (extracted from .[client]/skills/**/SKILL.md). Returns the name and description of each skill.',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'search_issues_and_prs',
        description: 'Search across all GitHub issues and pull requests in the organization.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' }
          },
          required: ['query']
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
          result = await searchDocs(args?.query as string);
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
        case 'list_api_schemas':
          result = listApiSchemas();
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        case 'list_company_skills':
          result = listCompanySkills();
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        case 'search_issues_and_prs':
          result = await searchIssuesAndPRs(args?.query as string);
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

  return server;
}
