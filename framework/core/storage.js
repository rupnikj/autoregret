// Virtual File System Storage (IndexedDB wrapper)
const DB_NAME = 'autoregret-files';
const STORE_NAME = 'files';
const HISTORY_STORE = 'history';
const DB_VERSION = 2;
let db = null;

export async function initStorage() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'name' });
      }
      if (!db.objectStoreNames.contains(HISTORY_STORE)) {
        db.createObjectStore(HISTORY_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = async (e) => {
      db = e.target.result;
      // Seed with initial files if empty
      const files = await listFiles();
      if (files.length === 0) await seedInitialFiles();
      resolve();
    };
    req.onerror = (e) => reject(e);
  });
}

async function seedInitialFiles() {
  // Load initial files from /app/ directory
  const initialFiles = [
    { name: 'App.js', path: 'app/App.js', modifiable: true, framework: 'vanilla' },
    { name: 'utils.js', path: 'app/utils.js', modifiable: true, framework: 'vanilla' },
    { name: 'config.json', path: 'app/config.json', modifiable: true, framework: 'vanilla' }
  ];
  for (const file of initialFiles) {
    try {
      const res = await fetch(file.path);
      const content = await res.text();
      await saveFile({
        name: file.name,
        content,
        modifiable: file.modifiable,
        framework: file.framework,
        lastModified: Date.now()
      });
    } catch (e) {
      // Ignore if fetch fails
    }
  }
}

export async function listFiles() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e);
  });
}

export async function loadFile(name) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(name);
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e);
  });
}

export async function saveFile(fileObj) {
  // Before saving, push the previous version to history
  const prev = await loadFile(fileObj.name);
  if (prev) {
    await pushHistory({
      name: prev.name,
      content: prev.content,
      modifiable: prev.modifiable,
      framework: prev.framework,
      lastModified: prev.lastModified,
      timestamp: Date.now()
    });
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    fileObj.lastModified = Date.now();
    const req = store.put(fileObj);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e);
  });
}

async function pushHistory(historyObj) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, 'readwrite');
    const store = tx.objectStore(HISTORY_STORE);
    const req = store.add(historyObj);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e);
  });
}

export async function listHistory(fileName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, 'readonly');
    const store = tx.objectStore(HISTORY_STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      // Filter by file name and sort by timestamp desc
      const filtered = req.result.filter(h => h.name === fileName).sort((a, b) => b.timestamp - a.timestamp);
      resolve(filtered);
    };
    req.onerror = (e) => reject(e);
  });
}

export async function restoreHistory(fileName, historyId) {
  // Find the history entry
  const entry = await getHistoryById(historyId);
  if (!entry) throw new Error('History entry not found');
  // Overwrite the file with this version
  await saveFile({
    name: entry.name,
    content: entry.content,
    modifiable: entry.modifiable,
    framework: entry.framework,
    lastModified: Date.now()
  });
}

async function getHistoryById(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, 'readonly');
    const store = tx.objectStore(HISTORY_STORE);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e);
  });
}

export async function deleteHistoryEntry(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, 'readwrite');
    const store = tx.objectStore(HISTORY_STORE);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e);
  });
} 