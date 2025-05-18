// Virtual File System Storage (IndexedDB wrapper)
const DB_NAME = 'autoregret-files';
const STORE_NAME = 'files';
const APP_HISTORY_STORE = 'appHistory';
const DB_VERSION = 2;
let db = null;
let suppressSnapshots = false;

export async function initStorage() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION + 1); // bump version for new store
    req.onupgradeneeded = (e) => {
      db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'name' });
      }
      if (!db.objectStoreNames.contains(APP_HISTORY_STORE)) {
        db.createObjectStore(APP_HISTORY_STORE, { keyPath: 'id', autoIncrement: true });
      }
      // Remove old per-file history store if present
      if (db.objectStoreNames.contains('history')) {
        db.deleteObjectStore('history');
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

// Helper for show welcome button setting
function getShowWelcomeButton() {
  const val = localStorage.getItem('autoregret_show_welcome_button');
  return val === null ? true : val === 'true';
}

async function seedInitialFiles() {
  suppressSnapshots = true;
  // Decide which App.js to use based on the toggle
  const showWelcome = getShowWelcomeButton();
  const appFile = showWelcome ? { name: 'App.js', path: 'app/App.js', modifiable: true, framework: 'vanilla' }
                             : { name: 'App.js', path: 'app/App.simple.js', modifiable: true, framework: 'vanilla' };
  const initialFiles = [
    appFile,
    { name: 'utils.js', path: 'app/utils.js', modifiable: true, framework: 'vanilla' },
    { name: 'config.json', path: 'app/config.json', modifiable: true, framework: 'vanilla' }
  ];
  const version = (typeof VERSION !== 'undefined') ? VERSION : (window.VERSION || '__VERSION__');
  for (const file of initialFiles) {
    try {
      const res = await fetch(`${file.path}?v=${version}`); // bust cache
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
  suppressSnapshots = false;
  // After all files are seeded, save version 0 app snapshot
  await saveAppSnapshot('initial');
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

export async function saveFile(fileObj, action = 'wish') {
  // Save the file
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    fileObj.lastModified = Date.now();
    const req = store.put(fileObj);
    req.onsuccess = async () => {
      // After saving, record a full app snapshot (unless suppressed)
      if (!suppressSnapshots) {
        await saveAppSnapshot(action);
      }
      resolve();
    };
    req.onerror = (e) => reject(e);
  });
}

export async function saveAppSnapshot(action = 'wish') {
  // Save a snapshot of all modifiable files, chat, wishes, action, timestamp
  const files = await listFiles();
  const modFiles = files.filter(f => f.modifiable);
  let chatHistory = [];
  let userWishes = [];
  try { chatHistory = JSON.parse(localStorage.getItem('autoregret_chat_history') || '[]'); } catch (e) {}
  try { userWishes = JSON.parse(localStorage.getItem('autoregret_user_wishes') || '[]'); } catch (e) {}
  return new Promise((resolve, reject) => {
    const tx = db.transaction(APP_HISTORY_STORE, 'readwrite');
    const store = tx.objectStore(APP_HISTORY_STORE);
    const req = store.add({
      files: modFiles,
      chatHistory,
      userWishes,
      action,
      timestamp: Date.now()
    });
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e);
  });
}

export async function listAppHistory() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(APP_HISTORY_STORE, 'readonly');
    const store = tx.objectStore(APP_HISTORY_STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      // Sort by timestamp desc
      const filtered = req.result.sort((a, b) => b.timestamp - a.timestamp);
      resolve(filtered);
    };
    req.onerror = (e) => reject(e);
  });
}

export async function restoreAppHistory(historyId) {
  // Find the app history entry
  const entry = await getAppHistoryById(historyId);
  if (!entry) throw new Error('App history entry not found');
  // Overwrite all modifiable files in a single transaction, without triggering saveFile
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  for (const file of entry.files) {
    store.put({ ...file, lastModified: Date.now() });
  }
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = reject;
  });
  // Restore chat history and wishes
  if (entry.chatHistory) {
    localStorage.setItem('autoregret_chat_history', JSON.stringify(entry.chatHistory));
  }
  if (entry.userWishes) {
    localStorage.setItem('autoregret_user_wishes', JSON.stringify(entry.userWishes));
  }
  // After all files and state are restored, record a single restore snapshot
  await saveAppSnapshot('restore');
}

async function getAppHistoryById(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(APP_HISTORY_STORE, 'readonly');
    const store = tx.objectStore(APP_HISTORY_STORE);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e);
  });
} 