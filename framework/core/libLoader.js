// Generic external library loader for AutoRegret (cdnjs only)

export function loadExternalLibrary({ globalVar, name, version, file = 'min.js', onload }) {
  if (window[globalVar]) {
    if (onload) onload();
    return Promise.resolve();
  }
  const src = `https://cdnjs.cloudflare.com/ajax/libs/${name}/${version}/${file}`;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => {
      if (onload) onload();
      resolve();
    };
    script.onerror = () => {
      reject(new Error(`Failed to load library: ${src}`));
    };
    document.head.appendChild(script);
  });
}

if (typeof window !== 'undefined') {
  window.loadExternalLibrary = loadExternalLibrary;
} 