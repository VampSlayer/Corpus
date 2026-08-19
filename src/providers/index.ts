import 'dotenv/config';
import { VcsProvider } from './types.js';
import { GitHubProvider } from './github.js';
import { GitLabProvider } from './gitlab.js';

export function getProvider(): VcsProvider {
  const providerType = process.env.VCS_PROVIDER || 'github';

  if (providerType === 'github') {
    const org = process.env.GIT_ORG;
    const pat = process.env.GIT_PAT;
    const gapProject = process.env.GITHUB_PROJECT;
    if (!org || !pat) throw new Error('GIT_ORG and GIT_PAT are required for github provider');
    return new GitHubProvider(org, pat, gapProject);
  }

  if (providerType === 'gitlab') {
    const token = process.env.GIT_PAT; // Reuse token var or use GITLAB_TOKEN
    const group = process.env.GIT_ORG; // Optional group filter
    const gapProject = process.env.GITHUB_PROJECT; // Project ID for issues
    const url = process.env.GITLAB_URL || 'https://gitlab.com';
    if (!token) throw new Error('GIT_PAT is required for gitlab provider (Personal Access Token)');
    return new GitLabProvider(token, group, gapProject, url);
  }

  throw new Error(`Unknown VCS_PROVIDER: ${providerType}`);
}
