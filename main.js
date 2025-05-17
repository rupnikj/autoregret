// Entry point for AutoRegret
const VERSION = '__VERSION__';
window.VERSION = VERSION;
import { initPanel } from './framework/ui/panel.js';
import { loadUserApp } from './framework/core/appLoader.js';
import { initStorage } from './framework/core/storage.js';

async function start() {
  await initStorage();
  initPanel();
  await loadUserApp();
}

start(); 