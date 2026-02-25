import { cpSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const dest = join(projectRoot, 'public', 'assets', 'vendor', 'zetajs');

// Search for zetajs in node_modules — handles both local dev and hoisted installs.
function findZetajsSource() {
  let dir = projectRoot;
  while (true) {
    const candidate = join(dir, 'node_modules', 'zetajs', 'source');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const src = findZetajsSource();
if (!src) {
  console.warn('zetajs source not found — skipping copy (run npm install first)');
  process.exit(0);
}

mkdirSync(dest, { recursive: true });
cpSync(join(src, 'zeta.js'), join(dest, 'zeta.js'));
cpSync(join(src, 'zetaHelper.js'), join(dest, 'zetaHelper.js'));

console.log('Copied zetajs files to public/assets/vendor/zetajs/');
