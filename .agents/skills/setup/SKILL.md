---
name: Corpus Setup Guide
description: Walkthrough for a new developer setting up the Corpus MCP server
---

# Setup Corpus MCP Server

Welcome! Because there is no committed corpus to fall back on, every developer builds their own corpus using their own GitHub PAT.

## Prerequisites

1. **Node.js**: Ensure you are running Node.js 18 or higher.

   ```bash
   node -v
   ```

2. **GitHub PAT**: Create a Personal Access Token (classic) with `repo` and `read:org` scopes, or a fine-grained token with access to all organization repositories and metadata/content read access.

## Configuration

Create a `.env` file in the root of the repository with the following variables:

```env
GIT_ORG=your-github-org
GIT_PAT=your-github-personal-access-token
ENABLE_GAP_REPORTING=false
GITHUB_PROJECT=your-github-org/doc-gaps-repo # Required only if ENABLE_GAP_REPORTING is true
```

## Setup and Build

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Start the server (this will automatically fetch and build the corpus and system map):
   ```bash
   npm start
   ```
   _Alternatively, you can manually run the build pipeline before starting:_
   ```bash
   npm run build:corpus
   npm run build:map
   npm run build
   ```

## Registering with Antigravity

Antigravity natively supports MCP. You can configure this server globally by adding it to `~/.gemini/config/mcp_config.json`:

```json
{
  "mcpServers": {
    "corpus": {
      "command": "node",
      "args": ["/absolute/path/to/code-context-mcp/dist/src/index.js"],
      "env": {
        "GIT_ORG": "your-github-org",
        "DOTENV_CONFIG_PATH": "/absolute/path/to/code-context-mcp/.env",
        "CORPUS_DIR": "/absolute/path/to/code-context-mcp/corpus"
      }
    }
  }
}
```

## Registering with Claude

To use Corpus with Claude Desktop or Claude Code, add it to your configuration.

### Claude Desktop

Edit your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "corpus": {
      "command": "node",
      "args": ["/absolute/path/to/code-context-mcp/dist/src/index.js"],
      "env": {
        "GIT_ORG": "your-github-org",
        "GIT_PAT": "your-github-pat",
        "CORPUS_DIR": "/absolute/path/to/code-context-mcp/corpus"
      }
    }
  }
}
```

### Claude Code

Run the following command inside the project directory (after `npm run build`):

```bash
claude mcp add corpus "node $(pwd)/dist/src/index.js"
```

## Known Unresolved Tradeoffs

- **Shared-PAT blast radius**: The server currently runs using a personal access token. If this token is exposed or over-privileged, it has a large blast radius.
- **Bearer-token auth being a stopgap**: As this relies on basic Bearer token authentication to GitHub APIs, it's a stopgap for a more robust OAuth or GitHub App integration.
- **Lexical-only search missing semantic matches**: The `search_docs` tool uses `minisearch` which relies on exact keywords. It does not understand synonyms or context (no vector search).
- **search_code's dependency on the GitHub Code Search extension**: `search_code` only searches the default branch and has size limitations.
- **Process-lifetime repo-index cache**: The `manifest.json` and memory index are only loaded at startup. You need to restart the server (or rebuild the corpus) to see newer documents.
