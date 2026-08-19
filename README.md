<div align="center">
  <img src="https://raw.githubusercontent.com/modelcontextprotocol/sdk/main/docs/static/img/mcp-logo.svg" width="100" height="100" alt="Corpus Logo">
  <h1>📚 Corpus</h1>

  <p>
    <em>A corpus is a large, structured collection of written or spoken texts stored on a computer and used for linguistic research, or a complete body of written work by a single author.</em>
  </p>

  <p>
    <strong>Create a Corpus for your entire codebase.</strong>
  </p>

  <p>
    <a href="https://modelcontextprotocol.io">
      <img src="https://img.shields.io/badge/MCP-Ready-blue?style=for-the-badge&logo=modelcontextprotocol" alt="MCP Ready" />
    </a>
    <a href="https://nodejs.org">
      <img src="https://img.shields.io/badge/Node.js-18+-green?style=for-the-badge&logo=node.js" alt="Node.js 18+" />
    </a>
    <a href="https://github.com">
      <img src="https://img.shields.io/badge/GitHub-Integrated-black?style=for-the-badge&logo=github" alt="GitHub Integrated" />
    </a>
  </p>
</div>

---

**Corpus** aggregates the documentation across all your organization's repositories, builds a live system map using Spotify Backstage catalog entities, and puts it all behind a powerful **Model Context Protocol (MCP)** server.

Give your AI agents (Claude, Copilot, etc.) the holistic context they need to understand your architecture, service ownership, docs, and code—all in one place!

## ✨ Features

- 🗺️ **Auto-Generated System Map**: Crawls `catalog-info.yaml` (Backstage-style) files to map dependencies (`calls`) and reverse-dependencies (`calledBy`) automatically.
- 📖 **Centralized Doc Search**: Fast lexical search across `README.md`, `docs/**/*.md`, `adr/**/*.md`, and AI skills across your entire org.
- 🔍 **Global Code Search**: Keyword search across all organization repositories via the GitHub Code Search API.
- 📄 **File Reading**: Direct access to precise file contents from any repository branch or commit.
- 🚀 **Zero-Config Start**: Auto-runs missing builds on startup. If you have credentials, just hit `npm start` and the server fetches and indexes everything.
- 🐞 **Gap Reporting**: Optional ability to file a GitHub issue when docs fail to answer an agent's question.

## 🛠️ Quick Start

### 1. Prerequisites

- **Node.js** v18+
- **GitHub PAT** (Personal Access Token) with `repo` and `read:org` scopes.

### 2. Configure Environment

Create a `.env` file in the root directory:

```env
GIT_ORG=your-github-org
GIT_PAT=your-github-personal-access-token

# Optional
ENABLE_GAP_REPORTING=false
GITHUB_PROJECT=your-github-org/doc-gaps-repo
```

### 3. Build & Run

```bash
npm install
npm run build
npm start
```

_Note: `npm start` automatically kicks off the corpus and system-map generation scripts if they haven't been run yet._

## 🤖 Registering with AI Clients

### Claude Desktop

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "corpus": {
      "command": "node",
      "args": ["/absolute/path/to/code-context-mcp/dist/index.js"],
      "env": {
        "GIT_ORG": "your-github-org",
        "GIT_PAT": "your-github-pat"
      }
    }
  }
}
```

### Claude Code

Run the following in the project root:

```bash
claude mcp add corpus "node $(pwd)/dist/index.js"
```

## 🏗️ Architecture & Commands

- `npm run build:corpus`: Crawls the GitHub org and downloads docs + catalog data into `corpus/manifest.json`.
- `npm run build:map`: Transforms the manifest into an active dependency graph saved to `corpus/system-map.yaml`.
- `npm run build`: Runs the full pipeline and compiles TypeScript.
- `npm run test`: Runs unit tests using the native Node.js test runner.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details on how to get started, set up your development environment, and submit Pull Requests.

This project enforces Conventional Commits. A pre-commit hook automatically formats your code with Prettier and checks it with ESLint.

See the [Setup Skill Guide](.claude/skills/setup/SKILL.md) for more details.

## 📄 License

Corpus is free to use. All intellectual property is owned by **Sayam Hussain**.

This project is licensed under the [MIT License](LICENSE).
