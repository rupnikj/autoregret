// App Loader: Loads and executes user app code from virtual FS
import { listFiles } from './storage.js';

export async function loadUserApp() {
  try {
    const files = await listFiles();
    // Load all .js files and concatenate their contents
    const jsFiles = files.filter(f => f.name.endsWith('.js'));
    console.log('[AutoRegret] Loading JS files:', jsFiles.map(f => f.name));
    let combined = '';
    for (const file of jsFiles) {
      // Remove 'export' statements
      let code = file.content.replace(/export\s+(const|let|var|function|class)\s+/g, '$1 ');
      // Replace 'const App =', 'let App =', 'var App =' with 'window.App ='
      code = code.replace(/\b(const|let|var)\s+App\s*=/, 'window.App =');
      combined += `\n// ---- ${file.name} ----\n` + code + '\n';
    }
    console.log('[AutoRegret] Combined user app code:', combined);
    // Evaluate in global scope
    // eslint-disable-next-line no-eval
    eval(combined);
    // Call App.init() if defined
    if (window.App && typeof window.App.init === 'function') {
      console.log('[AutoRegret] Calling App.init()');
      window.App.init();
    } else {
      console.warn('[AutoRegret] App.init() not found');
    }
  } catch (e) {
    console.error('Failed to load user app:', e);
  }
}
// Expose globally for reloads
window.autoregretLoadUserApp = loadUserApp; 