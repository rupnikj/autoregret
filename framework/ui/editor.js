import { loadFile, saveFile, listFiles } from '../core/storage.js';

let cmInstance = null;
let currentFile = 'App.js';
let currentFileObj = null;

export async function renderEditor(container) {
  container.innerHTML = `
    <div style="display:flex; flex-direction:column; height:100%;">
      <div style="margin-bottom:8px">
        <label for="cm-file-picker">File: </label>
        <select id="cm-file-picker"></select>
      </div>
      <div id="cm-editor" style="flex:1 1 0; min-height:0; border:1px solid #eee; border-radius:6px; overflow:auto;"></div>
      <div style="margin-top:8px; display:flex; align-items:center;">
        <button id="cm-save">Save</button>
        <span id="cm-status" style="margin-left:12px; color:#888; font-size:12px;"></span>
      </div>
    </div>
  `;
  const editorDiv = container.querySelector('#cm-editor');
  const saveBtn = container.querySelector('#cm-save');
  const status = container.querySelector('#cm-status');
  const filePicker = container.querySelector('#cm-file-picker');

  // Populate file picker
  const files = await listFiles();
  files.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.name;
    opt.textContent = f.name;
    if (f.name === currentFile) opt.selected = true;
    filePicker.appendChild(opt);
  });

  // Load file content
  currentFileObj = await loadFile(currentFile);
  const content = currentFileObj ? currentFileObj.content : '// File not found';

  // Use compatible versions from esm.sh
  const [{ EditorView, basicSetup }, { javascript }] = await Promise.all([
    import('https://esm.sh/codemirror@6.0.1'),
    import('https://esm.sh/@codemirror/lang-javascript@6.2.2')
  ]);
  if (cmInstance) cmInstance.destroy();
  let doc = content;
  cmInstance = new EditorView({
    doc,
    extensions: [basicSetup, javascript()],
    parent: editorDiv
  });

  saveBtn.onclick = async () => {
    await saveCurrentFile();
    status.textContent = 'Saved!';
    setTimeout(() => { status.textContent = ''; }, 1200);
    if (window.autoregretLoadUserApp) window.autoregretLoadUserApp();
  };

  filePicker.onchange = async (e) => {
    // Save current file before switching
    await saveCurrentFile();
    currentFile = filePicker.value;
    // Re-render editor with new file
    renderEditor(container);
  };
}

async function saveCurrentFile() {
  if (!currentFileObj) return;
  const newContent = cmInstance.state.doc.toString();
  if (newContent !== currentFileObj.content) {
    await saveFile({ ...currentFileObj, content: newContent });
    currentFileObj.content = newContent;
  }
} 