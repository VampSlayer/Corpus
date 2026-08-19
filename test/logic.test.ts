import test from 'node:test';
import assert from 'node:assert/strict';
import { isDocPath, buildEntityGraph, parseEntityRef } from '../src/logic.js';

test('isDocPath', async (t) => {
  await t.test('excludes CLAUDE.md and AGENTS.md', () => {
    assert.equal(isDocPath('CLAUDE.md'), false);
    assert.equal(isDocPath('AGENTS.md'), false);
  });

  await t.test('includes root README.md and catalog-info.yaml', () => {
    assert.equal(isDocPath('README.md'), true);
    assert.equal(isDocPath('catalog-info.yaml'), true);
  });

  await t.test('includes docs/**/*.md', () => {
    assert.equal(isDocPath('docs/architecture.md'), true);
    assert.equal(isDocPath('docs/nested/guide.md'), true);
    assert.equal(isDocPath('docs/image.png'), false); // not md
  });

  await t.test('includes adr/**/*.md', () => {
    assert.equal(isDocPath('adr/0001-init.md'), true);
  });

  await t.test('includes .claude/skills/**/SKILL.md', () => {
    assert.strictEqual(isDocPath('.claude/skills/setup/SKILL.md'), true);
  });

  await t.test('includes OpenAPI and Swagger schemas', () => {
    assert.strictEqual(isDocPath('openapi.yaml'), true);
    assert.strictEqual(isDocPath('docs/swagger.json'), true);
  });
});

test('parseEntityRef', async (t) => {
  await t.test('parses fully qualified ref', () => {
    assert.equal(parseEntityRef('component:default/auth'), 'component:default/auth');
  });

  await t.test('parses kind and name', () => {
    assert.equal(parseEntityRef('component:auth'), 'component:default/auth');
  });

  await t.test('applies default kind', () => {
    assert.equal(parseEntityRef('auth', 'group'), 'group:default/auth');
  });
});

test('buildEntityGraph', async (t) => {
  await t.test('computes reverse edges correctly', () => {
    const manifestRepos = {
      'repo-a': {
        catalogInfo: `
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: service-a
spec:
  type: service
  owner: group:auth-team
  dependsOn:
    - component:service-b
    - service-c
`
      },
      'repo-b': {
        catalogInfo: `
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: service-b
spec:
  type: service
`
      },
      'repo-c': {
        catalogInfo: `
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: service-c
spec:
  type: service
`
      },
      'repo-d': {
        catalogInfo: null // missing
      }
    };

    const { systemMap, missingCatalog } = buildEntityGraph(manifestRepos);

    assert.deepEqual(missingCatalog, ['repo-d']);

    // Service A should depend on B and C, and be owned by auth-team
    assert.deepEqual(systemMap['component:default/service-a'].relations.dependsOn, [
      'component:default/service-b',
      'component:default/service-c'
    ]);
    assert.deepEqual(systemMap['component:default/service-a'].relations.ownedBy, [
      'group:default/auth-team'
    ]);

    // Reverse edges should exist
    assert.deepEqual(systemMap['component:default/service-b'].relations.dependencyOf, [
      'component:default/service-a'
    ]);
    assert.deepEqual(systemMap['component:default/service-c'].relations.dependencyOf, [
      'component:default/service-a'
    ]);

    // Group auth-team should be created implicitly via reverse edge
    assert.deepEqual(systemMap['group:default/auth-team'].relations.ownerOf, [
      'component:default/service-a'
    ]);
  });
});
