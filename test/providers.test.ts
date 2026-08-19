import test from 'node:test';
import assert from 'node:assert/strict';
import { getProvider } from '../src/providers/index.js';
import { GitHubProvider } from '../src/providers/github.js';
import { GitLabProvider } from '../src/providers/gitlab.js';

test('Provider Factory', async (t) => {
  await t.test('instantiates GitHubProvider by default', () => {
    process.env.VCS_PROVIDER = 'github';
    process.env.GIT_ORG = 'test-org';
    process.env.GIT_PAT = 'test-pat';
    const provider = getProvider();
    assert.ok(provider instanceof GitHubProvider);
  });

  await t.test('instantiates GitLabProvider when configured', () => {
    process.env.VCS_PROVIDER = 'gitlab';
    process.env.GIT_ORG = 'test-group'; // mapped to group
    process.env.GIT_PAT = 'test-token';
    const provider = getProvider();
    assert.ok(provider instanceof GitLabProvider);
  });

  await t.test('throws on unknown provider', () => {
    process.env.VCS_PROVIDER = 'unknown-vcs';
    assert.throws(() => getProvider(), /Unknown VCS_PROVIDER: unknown-vcs/);
  });
});
