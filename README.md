<div align="center">
  <img src="assets/logo.jpg" width="200" height="200" alt="Corpus Logo">
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
      <img src="https://img.shields.io/badge/Node.js-22+-green?style=for-the-badge&logo=node.js" alt="Node.js 22+" />
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
- 💬 **Issue & PR Context**: Proxies to GitHub's search API to find discussions, PRs, and issues across the org (`search_issues_and_prs`).
- 📄 **File Reading**: Direct access to precise file contents from any repository branch or commit.
- ⚙️ **API Schema Aggregation**: Automatically indexes `openapi` and `swagger` files so agents can pull down endpoint contracts instantly (`list_api_schemas`).
- 🚀 **Zero-Config Start**: Auto-runs missing builds on startup. If you have credentials, just hit `npm start` and the server fetches and indexes everything.
- 🐞 **Gap Reporting**: Optional ability to file a GitHub issue when docs fail to answer an agent's question.

## 🛠️ Quick Start

### 1. Prerequisites

- **Node.js** v22+
- **GitHub PAT** (Personal Access Token):
  - **Classic Token**: Needs `repo` (to read private repos) and `read:org` (if querying an organization).
  - **Fine-Grained Token**: Needs `Contents: Read-only` and `Metadata: Read-only` for all repositories. If you enable `ENABLE_GAP_REPORTING`, you also need `Issues: Read & Write` on the target repository.

### 2. Configure Environment

Create a `.env` file in the root directory:

```env
GIT_ORG=your-github-org-or-username
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

### Antigravity

Antigravity natively supports MCP. Configure the server globally by adding it to `~/.gemini/config/mcp_config.json`:

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

### Claude Desktop

Add this to your `claude_desktop_config.json`:

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

Run the following in the project root:

```bash
claude mcp add corpus "node $(pwd)/dist/src/index.js"
```

## 🏗️ Architecture & Commands

- `npm run build:corpus`: Crawls the GitHub org and downloads docs + catalog data into `corpus/manifest.json`.
- `npm run build:map`: Transforms the manifest into an active dependency graph saved to `corpus/system-map.yaml`.
- `npm run build`: Runs the full pipeline and compiles TypeScript.
- `npm run test`: Runs unit tests using the native Node.js test runner.

## 🧩 System Map & `catalog-info.yaml`

Corpus automatically generates a global dependency graph of your organization's services. To participate in the system map, each repository should contain a `catalog-info.yaml` file at its root, conforming to the [Backstage Descriptor Format](https://backstage.io/docs/features/software-catalog/descriptor-format).

Ideally, your `catalog-info.yaml` should define a `Component` and list the services it depends on under `spec.dependsOn`. Corpus reads these dependencies and automatically computes the reverse edges (which services call yours) to create a complete map of your ecosystem!

**Example `catalog-info.yaml`:**

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: my-auth-service
  description: Handles user authentication and token generation
spec:
  type: service
  lifecycle: production
  owner: auth-team
  dependsOn:
    - component:user-database
    - component:email-service
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details on how to get started, set up your development environment, and submit Pull Requests.

This project enforces Conventional Commits. A pre-commit hook automatically formats your code with Prettier and checks it with ESLint.

See the [Setup Skill Guide](.agents/skills/setup/SKILL.md) for more details.

## 📄 License

Corpus is free to use. All intellectual property is owned by **Sayam Hussain**.

This project is licensed under the [MIT License](LICENSE).
