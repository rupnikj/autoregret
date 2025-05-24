// Library Discovery & Verification for AutoRegret (cdnjs only, experimental)
// Tools for AI and chat loop

/**
 * Search cdnjs libraries by keyword.
 * @param {string} keyword
 * @returns {Promise<Array>} Array of libraries
 */
export async function searchLibraries(keyword) {
  logStep(`Searching cdnjs for: ${keyword}`);
  const url = `https://api.cdnjs.com/libraries?search=${encodeURIComponent(keyword)}`;
  const resp = await fetch(url);
  const data = await resp.json();
  logStep(`Found ${data.results?.length || 0} libraries for '${keyword}'`);
  return data.results || [];
}

/**
 * Get cdnjs library metadata (versions, files, etc)
 * @param {string} libName
 * @returns {Promise<Object>} Metadata object
 */
export async function getLibraryMeta(libName) {
  logStep(`Fetching metadata for: ${libName}`);
  const url = `https://api.cdnjs.com/libraries/${encodeURIComponent(libName)}`;
  const resp = await fetch(url);
  const data = await resp.json();
  logStep(`Library '${libName}' has ${data.versions?.length || 0} versions`);
  return data;
}

/**
 * Test loading a candidate JS file from cdnjs.
 * - Checks fetch, script load, and global detection.
 * - Returns { success, detectedGlobal, error, url }
 * @param {Object} opts
 * @param {string} opts.url - Full JS file URL
 * @param {string} [opts.expectedGlobal] - Expected global var
 * @returns {Promise<Object>}
 */
export async function testLoadLibrary({ url, expectedGlobal }) {
  logStep(`Testing load for: ${url}`);
  // 1. Fetch HEAD to check existence
  try {
    const head = await fetch(url, { method: 'HEAD' });
    if (!head.ok) throw new Error(`HEAD ${head.status}`);
  } catch (e) {
    logStep(`Fetch failed: ${e.message}`);
    return { success: false, error: 'fetch-failed', url };
  }
  // 2. Record window keys before
  const before = new Set(Object.keys(window));
  // 3. Create script tag (no type="module")
  let script;
  let loadError = null;
  let loaded = false;
  await new Promise((resolve) => {
    script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.onload = () => { loaded = true; resolve(); };
    script.onerror = (e) => { loadError = e; resolve(); };
    document.head.appendChild(script);
  });
  // 4. Check for ESM (no type="module" used, but some files may still be ESM)
  if (!loaded) {
    logStep('Script failed to load');
    script.remove();
    return { success: false, error: 'script-load-failed', url };
  }
  // 5. Diff window keys after
  const after = new Set(Object.keys(window));
  const newGlobals = [...after].filter(k => !before.has(k));
  let detectedGlobal = null;
  if (expectedGlobal && window[expectedGlobal]) {
    detectedGlobal = expectedGlobal;
  } else {
    detectedGlobal = newGlobals.find(g => typeof window[g] === 'object' || typeof window[g] === 'function');
  }
  // 6. Clean up script tag
  script.remove();
  // 7. Return result
  if (detectedGlobal) {
    logStep(`Detected global: ${detectedGlobal}`);
    return { success: true, detectedGlobal, url };
  } else {
    logStep('No global detected');
    return { success: false, error: 'no-global', url };
  }
}

/**
 * Check if a library is already loaded (by global var)
 * @param {string} globalVar
 * @returns {boolean}
 */
export function isLibraryLoaded(globalVar) {
  const loaded = !!window[globalVar];
  if (loaded) logStep(`Library already loaded: ${globalVar}`);
  return loaded;
}

/**
 * Concise debug logger for libDiscover
 * @param {string} msg
 * @param {any} [data]
 */
export function logStep(msg, data) {
  if (data !== undefined) {
    console.log(`[libDiscover] ${msg}`, data);
  } else {
    console.log(`[libDiscover] ${msg}`);
  }
} 