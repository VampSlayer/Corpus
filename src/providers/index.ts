import 'dotenv/config';
import { VcsProvider } from './types.js';
import { GitHubProvider } from './github.js';
import { GitLabProvider } from './gitlab.js';
import { BitbucketProvider } from './bitbucket.js';
import { AzureDevOpsProvider } from './azure.js';

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
    const token = process.env.GIT_PAT;
    const group = process.env.GIT_ORG;
    const gapProject = process.env.GITHUB_PROJECT;
    const url = process.env.GITLAB_URL || 'https://gitlab.com';
    if (!token) throw new Error('GIT_PAT is required for gitlab provider (Personal Access Token)');
    return new GitLabProvider(token, group, gapProject, url);
  }

  if (providerType === 'bitbucket') {
    const workspace = process.env.GIT_ORG;
    const token = process.env.GIT_PAT; // App Password (username:password) or OAuth Bearer Token
    if (!workspace || !token)
      throw new Error(
        'GIT_ORG (workspace) and GIT_PAT (App Password/Token) are required for bitbucket provider'
      );
    return new BitbucketProvider(workspace, token);
  }

  if (providerType === 'azure') {
    const org = process.env.GIT_ORG;
    const pat = process.env.GIT_PAT;
    const project = process.env.GITHUB_PROJECT; // Maps to Azure Project
    if (!org || !pat)
      throw new Error('GIT_ORG (organization) and GIT_PAT (PAT) are required for azure provider');
    return new AzureDevOpsProvider(org, pat, project);
  }

  throw new Error(`Unknown VCS_PROVIDER: ${providerType}`);
}
