import { cpSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const dest = join(projectRoot, 'public', 'assets', 'vendor', 'zetajs');
const src = join(projectRoot, 'node_modules', 'zetajs', 'source');

mkdirSync(dest, { recursive: true });
cpSync(join(src, 'zeta.js'), join(dest, 'zeta.js'));
cpSync(join(src, 'zetaHelper.js'), join(dest, 'zetaHelper.js'));

console.log('Copied zetajs files to public/assets/vendor/zetajs/');
