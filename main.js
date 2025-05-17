// Entry point for AutoRegret
const VERSION = '1747485737653';
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