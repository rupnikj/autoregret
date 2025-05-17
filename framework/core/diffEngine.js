// Diff Engine using jsdiff from CDN
let jsdiff = null;

async function getJsDiff() {
  if (!jsdiff) {
    jsdiff = await import('https://esm.sh/diff@5.2.0');
  }
  return jsdiff;
}

export async function previewDiff(fileContent, newContent, fileName = 'file.js') {
  const { createPatch } = await getJsDiff();
  // Returns a unified diff string
  return createPatch(fileName, fileContent, newContent);
}

export async function applyDiff(fileContent, patch) {
  const { applyPatch } = await getJsDiff();
  // Returns the patched content (or original if patch fails)
  const result = applyPatch(fileContent, patch);
  return typeof result === 'string' ? result : fileContent;
} 