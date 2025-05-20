// Generic external library loader for AutoRegret (cdnjs only)

/**
 * Loads an external library from a full cdnjs URL.
 * @param {Object} options
 * @param {string} options.url - Full cdnjs file URL (case-sensitive, e.g. https://cdnjs.cloudflare.com/ajax/libs/tone/15.1.5/Tone.js)
 * @param {string} options.globalVar - The global variable to check for library presence
 * @param {function} [options.onload] - Callback after load
 */
export function loadExternalLibrary({ url, globalVar, onload }) {
  if (window[globalVar]) {
    if (onload) onload();
    return Promise.resolve();
  }
  if (!url) throw new Error('You must provide a full cdnjs file URL to loadExternalLibrary.');
  // First, check if the URL is reachable and status is 200
  return fetch(url, { method: 'HEAD' })
    .then(resp => {
      if (!resp.ok) {
        throw new Error(`Failed to load library: ${url} (HTTP ${resp.status} ${resp.statusText})`);
      }
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.onload = () => {
          if (onload) onload();
          resolve();
        };
        script.onerror = () => {
          reject(new Error(`Failed to load library: ${url} (script error after successful fetch)`));
        };
        document.head.appendChild(script);
      });
    })
    .catch(err => {
      return Promise.reject(err);
    });
}

if (typeof window !== 'undefined') {
  window.loadExternalLibrary = loadExternalLibrary;
} 