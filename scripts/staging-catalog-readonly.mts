/**
 * Local read-only catalog check for the new Shopify store.
 *
 * Reads only `<repo>/.env.staging.local`. Does not load `.env.local`,
 * does not change process.env Shopify variables, and does not call the Admin API.
 *
 *   node --import ./scripts/register-ts-paths.mjs --experimental-strip-types scripts/staging-catalog-readonly.mts
 *   node --import ./scripts/register-ts-paths.mjs --experimental-strip-types scripts/staging-catalog-readonly.mts --read
 *
 * The default command does not contact Shopify. `--read` runs the fixed Storefront catalog query.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STAGING_REQUIRED_KEYS,
  StagingConfigError,
  assertOfflineStagingProcess,
  assertStagingRealpath,
  catalogFailureFromError,
  parseStagingEnvText,
  publicStagingStatus,
  readStagingCatalog,
  resolveStagingEnvPath,
} from '@/lib/shopify/staging-catalog';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function printJson(value: unknown) {
  console.log(JSON.stringify(value));
}

async function main() {
  assertOfflineStagingProcess(process.env);
  const envPath = resolveStagingEnvPath(repoRoot);
  const readRequested = process.argv.includes('--read');

  if (!fs.existsSync(envPath)) {
    printJson({
      stagingFile: 'missing',
      required: STAGING_REQUIRED_KEYS,
      shopifyContacted: false,
      writesEnabled: false,
    });
    process.exitCode = 2;
    return;
  }

  const realPath = fs.realpathSync(envPath);
  assertStagingRealpath(repoRoot, realPath);
  const parsed = parseStagingEnvText(fs.readFileSync(realPath, 'utf8'));
  const status = publicStagingStatus(parsed);

  if (!readRequested) {
    printJson(status);
    process.exitCode = parsed.ok ? 0 : 2;
    return;
  }

  if (!parsed.ok) {
    printJson(status);
    process.exitCode = 2;
    return;
  }

  try {
    const summary = await readStagingCatalog({
      domain: parsed.domain,
      token: parsed.token,
    });
    printJson(summary);
  } catch (error) {
    const summary = catalogFailureFromError(error);
    printJson({
      ...summary,
      errorCode: error instanceof StagingConfigError ? error.code : 'storefront_unreachable',
    });
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  const code = error instanceof StagingConfigError ? error.code : 'staging_check_failed';
  printJson({
    shopifyContacted: false,
    writesEnabled: false,
    errorCode: code,
  });
  process.exitCode = 1;
});
