import yaml from 'yaml';

export function isDocPath(p: string): boolean {
  if (p === 'CLAUDE.md' || p === 'AGENTS.md') return false;
  if (p === 'README.md' || p === 'catalog-info.yaml') return true;
  if (p.startsWith('docs/') && p.endsWith('.md')) return true;
  if (p.startsWith('adr/') && p.endsWith('.md')) return true;
  if (p.match(/^\.[^/]+\/skills\/.*\/SKILL\.md$/)) return true;
  if (p.match(/(openapi|swagger)\.(yaml|yml|json)$/i)) return true;
  return false;
}

export function parseEntityRef(
  ref: string,
  defaultKind?: string,
  defaultNamespace = 'default'
): string {
  if (!ref) return '';
  let kind = defaultKind;
  let namespace = defaultNamespace;
  let name = ref;

  const colonIdx = name.indexOf(':');
  if (colonIdx !== -1) {
    kind = name.substring(0, colonIdx);
    name = name.substring(colonIdx + 1);
  }

  const slashIdx = name.indexOf('/');
  if (slashIdx !== -1) {
    namespace = name.substring(0, slashIdx);
    name = name.substring(slashIdx + 1);
  }

  kind = kind ? kind.toLowerCase() : 'unknown';
  namespace = namespace.toLowerCase();

  return `${kind}:${namespace}/${name}`;
}

export function buildEntityGraph(manifestRepos: Record<string, any>): {
  systemMap: Record<string, any>;
  missingCatalog: string[];
} {
  const systemMap: Record<string, any> = {};
  const missingCatalog: string[] = [];

  const edgeTuples: Array<{ source: string; target: string; type: string }> = [];

  const addEdge = (source: string, target: string, type: string) => {
    edgeTuples.push({ source, target, type });
  };

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
        if (!doc.kind || !doc.metadata || !doc.metadata.name) continue;

        const kind = doc.kind;
        const ref = parseEntityRef(doc.metadata.name, kind, doc.metadata.namespace);

        if (!systemMap[ref]) {
          systemMap[ref] = {
            repo: repoName,
            kind: doc.kind,
            type: doc.spec?.type || 'unknown',
            description: doc.metadata.description || '',
            relations: {}
          };
        }

        const spec = doc.spec || {};

        if (spec.owner) {
          addEdge(ref, parseEntityRef(spec.owner, 'group'), 'ownedBy');
        }
        if (spec.system) {
          addEdge(ref, parseEntityRef(spec.system, 'system'), 'partOf');
        }
        if (Array.isArray(spec.dependsOn)) {
          for (const dep of spec.dependsOn) {
            addEdge(ref, parseEntityRef(dep, 'component'), 'dependsOn');
          }
        }
        if (Array.isArray(spec.providesApis)) {
          for (const api of spec.providesApis) {
            addEdge(ref, parseEntityRef(api, 'api'), 'providesApi');
          }
        }
        if (Array.isArray(spec.consumesApis)) {
          for (const api of spec.consumesApis) {
            addEdge(ref, parseEntityRef(api, 'api'), 'consumesApi');
          }
        }
      }
    } catch (e) {
      missingCatalog.push(repoName);
    }
  }

  const reverseMap: Record<string, string> = {
    ownedBy: 'ownerOf',
    partOf: 'hasPart',
    dependsOn: 'dependencyOf',
    providesApi: 'apiProvidedBy',
    consumesApi: 'apiConsumedBy'
  };

  for (const edge of edgeTuples) {
    const { source, target, type } = edge;
    const reverseType = reverseMap[type];

    if (!systemMap[source]) {
      systemMap[source] = { relations: {} };
    }
    if (!systemMap[source].relations) systemMap[source].relations = {};
    if (!systemMap[source].relations[type]) systemMap[source].relations[type] = [];
    if (!systemMap[source].relations[type].includes(target)) {
      systemMap[source].relations[type].push(target);
    }

    if (!systemMap[target]) {
      systemMap[target] = { relations: {} };
    }
    if (!systemMap[target].relations) systemMap[target].relations = {};
    if (!systemMap[target].relations[reverseType]) systemMap[target].relations[reverseType] = [];
    if (!systemMap[target].relations[reverseType].includes(source)) {
      systemMap[target].relations[reverseType].push(source);
    }
  }

  for (const ref of Object.keys(systemMap)) {
    if (systemMap[ref].relations) {
      for (const rel of Object.keys(systemMap[ref].relations)) {
        systemMap[ref].relations[rel].sort();
      }
    }
  }

  return { systemMap, missingCatalog };
}
