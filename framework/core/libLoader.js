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
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = () => {
      if (onload) onload();
      resolve();
    };
    script.onerror = () => {
      reject(new Error(`Failed to load library: ${url}`));
    };
    document.head.appendChild(script);
  });
}

if (typeof window !== 'undefined') {
  window.loadExternalLibrary = loadExternalLibrary;
} 