// Bundles the server and the Electron main process into plain JavaScript,
// so the installed app needs no TypeScript, no node_modules, and no Docker.
import { build } from 'esbuild';
import { existsSync } from 'node:fs';

if (!existsSync('../web/dist/index.html')) {
  console.error('Build the web app first: npm run build (from the repository root).');
  process.exit(1);
}

const common = { bundle: true, platform: 'node', target: 'node22', logLevel: 'info', legalComments: 'none' };
await build({ ...common, entryPoints: ['../server/src/index.ts'], format: 'esm', outfile: 'dist/server.mjs',
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" } });
await build({ ...common, entryPoints: ['src/main.ts'], format: 'cjs', outfile: 'dist/main.cjs', external: ['electron'] });
