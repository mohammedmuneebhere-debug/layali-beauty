import { existsSync } from 'node:fs';
import { dirname, extname, resolve as pathResolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = pathResolve(dirname(fileURLToPath(import.meta.url)), '..');

function fileCandidates(base) {
  return [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.mts`,
    `${base}.js`,
    `${base}.mjs`,
    pathResolve(base, 'index.ts'),
    pathResolve(base, 'index.tsx'),
    pathResolve(base, 'index.js'),
    pathResolve(base, 'index.mjs'),
  ];
}

function firstExisting(candidates) {
  for (const candidate of candidates) {
    if (existsSync(candidate)) return pathToFileURL(candidate).href;
  }
  return null;
}

function resolveAlias(specifier) {
  if (!specifier.startsWith('@/')) return null;
  const base = pathResolve(root, 'src', specifier.slice(2));
  return firstExisting(fileCandidates(base)) ?? pathToFileURL(`${base}.ts`).href;
}

function resolveRelative(specifier, parentURL) {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) return null;
  if (extname(specifier)) return null;
  const parentPath = fileURLToPath(parentURL);
  const base = pathResolve(dirname(parentPath), specifier);
  return firstExisting(fileCandidates(base));
}

export async function resolve(specifier, context, nextResolve) {
  const aliased = resolveAlias(specifier);
  if (aliased) {
    return nextResolve(aliased, context);
  }

  if (context.parentURL) {
    const relative = resolveRelative(specifier, context.parentURL);
    if (relative) {
      return nextResolve(relative, context);
    }
  }

  return nextResolve(specifier, context);
}
