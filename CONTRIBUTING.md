# Contributing to Corpus

First off, thank you for considering contributing to Corpus! It's people like you that make this tool powerful and useful for everyone.

## Development Setup

1. **Clone the repository**:

   ```bash
   git clone <repository-url>
   cd code-context-mcp
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Set up Environment**:
   Create a `.env` file with your `GIT_ORG` and `GIT_PAT` as detailed in the README.

## Contribution Workflow

We use a standard GitHub flow and enforce [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

1. **Create a branch**:
   Branch off of `main` for your work.

   ```bash
   git checkout -b feature/my-awesome-feature
   ```

2. **Make your changes**:
   Ensure you follow the project's coding style. The project uses TypeScript, ESLint, and Prettier.

3. **Testing**:
   If you add pure logic, write tests in the `test/` directory. Run tests before committing:

   ```bash
   npm run test
   ```

4. **Commit your changes**:
   This project uses `husky` and `commitlint` to enforce Conventional Commits.
   When you run `git commit`, the hooks will automatically run ESLint and Prettier, and verify your commit message format.
   Example commit message:

   ```
   feat: add support for parsing python docstrings
   ```

5. **Submit a Pull Request**:
   Push your branch and open a PR against `main`. Provide a clear description of the problem you're solving or the feature you're adding.

## Intellectual Property

Corpus is free to use. All intellectual property rights are retained by Sayam Hussain. By contributing to this repository, you agree to license your contributions under the project's [MIT License](LICENSE).
