/** Reset default application knowledge; never drop application/account metadata. */
import { ArangoClient, configFromEnvironment, elasticsearchEntityIndexName } from '../src/server/arangodb';
import { resolve } from 'node:path';

export function parseResetArguments(args:string[]) {
  const accepted = new Set(['--execute','--dry-run','--help']);
  for (const arg of args) if (!accepted.has(arg)) throw new Error('Unknown argument: ' + arg);
  if (args.includes('--execute') && args.includes('--dry-run')) throw new Error('Choose either --execute or --dry-run');
  return { execute:args.includes('--execute'), help:args.includes('--help') };
}
async function main() {
  const options = parseResetArguments(process.argv.slice(2));
  if (options.help) {
    console.log('bun scripts/reset-default-database.ts [--dry-run | --execute]');
    console.log('Default: preview only. --execute clears default entity/link collections and its ES index, archives the import checkpoint, and retains schema/application/accounts. Stop import writers first.');
    return;
  }
  // Resolve all paths against the repository so invocation from another directory is safe.
  const root = resolve(import.meta.dir, '..');
  process.chdir(root);
  if (!options.execute) {
    const config = configFromEnvironment(); if (!config) throw new Error('Missing ArangoDB configuration');
    const client = new ArangoClient(config);
    const counts:Record<string,number> = {};
    for (const collection of ['entity','link']) {
      const {body} = await client.database('default','/_api/collection/'+collection+'/count');
      counts[collection] = body.count;
    }
    console.log(JSON.stringify({dryRun:true,database:'default',counts,
      searchIndex:process.env.ELASTICSEARCH_URL ? elasticsearchEntityIndexName('default') : null,
      checkpoint:'data/wikidata-import.checkpoint.json',
      retained:['application configuration','type and ontology definitions','accounts','other applications']}));
    console.log('No changes made. To reset: bun scripts/reset-default-database.ts --execute');
    return;
  }
  const child = Bun.spawn([process.execPath,resolve(root,'scripts/reset-default-knowledge.ts'),'--confirm-default'],{
    cwd:root, env:process.env, stdin:'inherit', stdout:'inherit', stderr:'inherit',
  });
  const code = await child.exited;
  if (code !== 0) throw new Error('Default database reset failed; review the output before retrying.');
}
if (import.meta.main) main().catch(error=>{console.error(error.message);process.exitCode=1;});
