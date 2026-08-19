import yaml from 'yaml';

export function isDocPath(p: string): boolean {
  if (p === 'CLAUDE.md' || p === 'AGENTS.md') return false;
  if (p === 'README.md' || p === 'catalog-info.yaml') return true;
  if (p.startsWith('docs/') && p.endsWith('.md')) return true;
  if (p.startsWith('adr/') && p.endsWith('.md')) return true;
  if (p.match(/^\.claude\/skills\/.*\/SKILL\.md$/)) return true;
  if (p.match(/(openapi|swagger)\.(yaml|yml|json)$/i)) return true;
  return false;
}

export function computeReverseEdges(manifestRepos: Record<string, any>): {
  systemMap: Record<string, any>;
  missingCatalog: string[];
} {
  const systemMap: Record<string, any> = {};
  const missingCatalog: string[] = [];
  const calledByMap: Record<string, string[]> = {};

  for (const [repoName, repoData] of Object.entries(manifestRepos)) {
    const catalogRaw = (repoData as any).catalogInfo;
    if (!catalogRaw) {
      missingCatalog.push(repoName);
      continue;
    }

    try {
      const docs = yaml
        .parseAllDocuments(catalogRaw)
        .map((d) => d.toJSON())
        .filter(Boolean);
      for (const doc of docs) {
        if (doc.kind === 'Component' && doc.metadata && doc.metadata.name) {
          const name = doc.metadata.name;
          const dependsOn = doc.spec?.dependsOn || [];

          systemMap[name] = {
            repo: repoName,
            type: doc.spec?.type || 'unknown',
            description: doc.metadata.description || '',
            calls: dependsOn,
            calledBy: []
          };

          for (const dep of dependsOn) {
            let depName = dep;
            if (dep.includes(':')) {
              depName = dep.split(':').pop() || dep;
              if (depName.includes('/')) {
                depName = depName.split('/').pop() || depName;
              }
            }
            if (!calledByMap[depName]) {
              calledByMap[depName] = [];
            }
            calledByMap[depName].push(name);
          }
        }
      }
    } catch (e) {
      missingCatalog.push(repoName);
    }
  }

  for (const [name, component] of Object.entries(systemMap)) {
    if (calledByMap[name]) {
      component.calledBy = Array.from(new Set(calledByMap[name])).sort();
    }
  }

  return { systemMap, missingCatalog };
}
