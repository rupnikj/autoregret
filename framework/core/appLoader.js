// App Loader: Loads and executes user app code from virtual FS
import { listFiles } from './storage.js';
import { addDebugLog } from '../ui/debug.js';

export async function loadUserApp() {
  try {
    // --- Cleanup before loading new app code ---
    if (window.App && typeof window.App.cleanup === 'function') {
      try { window.App.cleanup(); } catch (e) { console.warn('Cleanup error:', e); }
    }
    // --- Ensure loader is available globally ---
    let version = (typeof VERSION !== 'undefined') ? VERSION : (window.VERSION || '__VERSION__');
    let loaderCode = await fetch(`framework/core/libLoader.js?v=${version}`).then(r => r.text());
    loaderCode = loaderCode.replace(/export\s+(function|const|let|var|class)\s+/g, '$1 ');
    eval(loaderCode);
    const files = await listFiles();
    // Load all .js files and concatenate their contents
    const jsFiles = files.filter(f => f.name.endsWith('.js'));
    console.log('[AutoRegret] Loading JS files:', jsFiles.map(f => f.name));
    let combined = '';
    for (const file of jsFiles) {
      // Remove 'export' statements
      let code = file.content.replace(/export\s+(const|let|var|function|class)\s+/g, '$1 ');
      // Replace 'const App =', 'let App =', 'var App =' with 'window.App ='
      code = code.replace(/\b(const|let|var)\s+App\s*=\s*/, 'window.App =');
      combined += `// ---- ${file.name} ----\n` + code + '\n';
    }
    console.log('[AutoRegret] Combined user app code:\n', combined);
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
    // console.error('Failed to load user app:', e); // Removed to prevent double logging
    let msg = e && e.message ? e.message : String(e);
    let stack = e && e.stack ? e.stack : '';
    let lineInfo = '';
    // Try to extract line/col from stack or message
    if (stack) {
      // Look for (App.js:LINE:COL) or similar
      const m = stack.match(/(\w+\.js):(\d+):(\d+)/);
      if (m) {
        lineInfo = `\nFile: ${m[1]}  Line: ${m[2]}  Col: ${m[3]}`;
      }
    }
    if (!lineInfo && msg) {
      // Sometimes line info is in the message
      const m = msg.match(/(\w+\.js):(\d+):(\d+)/);
      if (m) {
        lineInfo = `\nFile: ${m[1]}  Line: ${m[2]}  Col: ${m[3]}`;
      }
    }
    addDebugLog(`Failed to load user app: ${msg}${lineInfo}\n${stack ? stack : ''}`, 'error');
  }
}
// Expose globally for reloads
window.autoregretLoadUserApp = loadUserApp; 