import './style.css';

// Load the ZetaOffice bootstrap script (lives in public/, not bundled by Vite).
// All zetajs interaction happens there because zetaHelper.js uses import.meta.url
// for path resolution and cannot be processed by Vite's bundler.
const bootstrapScript = document.createElement('script');
bootstrapScript.type = 'module';
bootstrapScript.src = './soffice-bootstrap.js';
document.body.appendChild(bootstrapScript);
