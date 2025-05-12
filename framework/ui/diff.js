import { loadFile, saveFile, listFiles } from '../core/storage.js';
import { previewDiff, applyDiff } from '../core/diffEngine.js';

let lastDiff = '';
let lastOriginal = '';
let lastFileName = 'App.js';
let lastFileObj = null;
let containerRef = null;
let pendingDiff = null; // { fileName, content }

export function setPendingDiff(diffObj) {
  pendingDiff = diffObj;
}

export async function renderDiff(container) {
  containerRef = container;
  // If there is a pending diff (from chat), set lastFileName to the correct file before rendering
  if (pendingDiff && pendingDiff.fileName) {
    lastFileName = pendingDiff.fileName;
  }
  container.innerHTML = `
    <div style="margin-bottom:8px">
      <label for="diff-file-picker">File: </label>
      <select id="diff-file-picker"></select>
    </div>
    <textarea id="diff-proposed" style="width:100%;height:100px;" placeholder="Paste or edit the new version here..."></textarea>
    <div style="margin:8px 0">
      <button id="diff-preview">Preview Diff</button>
      <button id="diff-apply" disabled>Apply Patch</button>
      <span id="diff-status" style="margin-left:12px; color:#888; font-size:12px;"></span>
    </div>
    <pre id="diff-output" style="background:#f9f9f9; padding:8px; border-radius:6px; overflow:auto; max-height:180px;"></pre>
  `;
  const filePicker = container.querySelector('#diff-file-picker');
  const proposed = container.querySelector('#diff-proposed');
  const previewBtn = container.querySelector('#diff-preview');
  const applyBtn = container.querySelector('#diff-apply');
  const status = container.querySelector('#diff-status');
  const output = container.querySelector('#diff-output');

  // Populate file picker
  const files = await listFiles();
  files.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.name;
    opt.textContent = f.name;
    if (f.name === lastFileName) opt.selected = true;
    filePicker.appendChild(opt);
  });

  async function loadAndSetFile(name) {
    lastFileObj = await loadFile(name);
    lastOriginal = lastFileObj ? lastFileObj.content : '';
    proposed.value = lastOriginal;
    lastFileName = name;
    output.textContent = '';
    applyBtn.disabled = true;
    status.textContent = '';
  }

  // If there is a pending diff (from chat), only load and show that file/content
  if (pendingDiff) {
    const { fileName, content } = pendingDiff;
    lastFileObj = await loadFile(fileName);
    lastOriginal = lastFileObj ? lastFileObj.content : '';
    lastFileName = fileName;
    if (filePicker) filePicker.value = fileName;
    if (proposed) proposed.value = content;
    output.textContent = '';
    applyBtn.disabled = true;
    status.textContent = '';
    // Use a microtask to ensure DOM is ready before previewing diff
    Promise.resolve().then(async () => {
      status.textContent = 'Generating diff...';
      lastDiff = await previewDiff(lastOriginal, content, lastFileName);
      output.innerHTML = colorizeDiff(lastDiff);
      status.textContent = 'Diff previewed.';
      applyBtn.disabled = false;
    });
    pendingDiff = null;
  } else {
    await loadAndSetFile(lastFileName);
  }

  filePicker.onchange = async () => {
    await loadAndSetFile(filePicker.value);
  };

  previewBtn.onclick = async () => {
    status.textContent = 'Generating diff...';
    const newContent = proposed.value;
    lastDiff = await previewDiff(lastOriginal, newContent, lastFileName);
    output.innerHTML = colorizeDiff(lastDiff);
    status.textContent = 'Diff previewed.';
    applyBtn.disabled = false;
  };

  applyBtn.onclick = async () => {
    status.textContent = 'Applying patch...';
    const patched = await applyDiff(lastOriginal, lastDiff);
    await saveFile({
      ...lastFileObj,
      content: patched,
      lastModified: Date.now()
    });
    status.textContent = 'Patch applied and file saved!';
    lastOriginal = patched;
    setTimeout(() => { status.textContent = ''; }, 1200);
    if (window.autoregretLoadUserApp) window.autoregretLoadUserApp();
  };
}

function colorizeDiff(diffText) {
  return diffText.split('\n').map(line => {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      return `<div style='background:#e6ffed;color:#22863a;'>${escapeHTML(line)}</div>`;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      return `<div style='background:#ffeef0;color:#b31d28;'>${escapeHTML(line)}</div>`;
    } else if (line.startsWith('@@')) {
      return `<div style='background:#f1f8ff;color:#0366d6;font-weight:bold;'>${escapeHTML(line)}</div>`;
    } else if (line.startsWith('+++') || line.startsWith('---')) {
      return `<div style='background:#f6f8fa;color:#6a737d;'>${escapeHTML(line)}</div>`;
    } else {
      return `<div style='color:#24292e;'>${escapeHTML(line)}</div>`;
    }
  }).join('');
}

function escapeHTML(str) {
  return str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
} 