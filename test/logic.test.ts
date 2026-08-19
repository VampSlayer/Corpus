import test from 'node:test';
import assert from 'node:assert/strict';
import { isDocPath, computeReverseEdges } from '../src/logic.js';

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
    assert.equal(isDocPath('.claude/skills/other.md'), false);
  });

  await t.test('includes OpenAPI and Swagger schemas', () => {
    assert.strictEqual(isDocPath('openapi.yaml'), true);
    assert.strictEqual(isDocPath('docs/swagger.json'), true);
    assert.strictEqual(isDocPath('api/OpenApi.yml'), true);
    assert.strictEqual(isDocPath('something-else.yaml'), false);
  });
});

test('computeReverseEdges', async (t) => {
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

    const { systemMap, missingCatalog } = computeReverseEdges(manifestRepos);

    assert.deepEqual(missingCatalog, ['repo-d']);
    assert.equal(systemMap['service-a'].calls.length, 2);
    assert.deepEqual(systemMap['service-a'].calledBy, []);

    assert.deepEqual(systemMap['service-b'].calledBy, ['service-a']);
    assert.deepEqual(systemMap['service-c'].calledBy, ['service-a']);
  });
});
