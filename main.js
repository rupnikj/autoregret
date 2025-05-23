// Entry point for AutoRegret
const VERSION = '1748037302976';
window.VERSION = VERSION;
import { initPanel } from './framework/ui/panel.js';
import { loadUserApp } from './framework/core/appLoader.js';
import { initStorage } from './framework/core/storage.js';
import { addDebugLog } from './framework/ui/debug.js';

async function start() {
  await initStorage();
  initPanel();
  await loadUserApp();
}

// Capture console logs and errors
(function() {
  const origLog = window.console.log;
  const origError = window.console.error;
  window.console.log = function(...args) {
    addDebugLog(args.map(String).join(' '), 'log');
    origLog.apply(console, args);
  };
  window.console.error = function(...args) {
    addDebugLog(args.map(String).join(' '), 'error');
    origError.apply(console, args);
  };
  window.onerror = function(msg, src, line, col, err) {
    let errorMsg = String(msg || 'Unknown error');
    // Avoid double 'Uncaught'
    if (/^Uncaught/i.test(errorMsg)) errorMsg = errorMsg.replace(/^Uncaught:?\s*/i, '');
    let source = src && src !== '<anonymous>' ? src : '[User App]';
    let lineCol = (line || col) ? ` (at ${source}:${line || '?'}:${col || '?'})` : '';
    let stack = err && err.stack ? `\n${err.stack}` : '';
    addDebugLog(`Uncaught: ${errorMsg}${lineCol}${stack}`, 'error');
    return false;
  };
  window.addEventListener('unhandledrejection', function(event) {
    let reason = event.reason;
    let errorMsg = reason && reason.message ? reason.message : String(reason);
    let stack = reason && reason.stack ? `\n${reason.stack}` : '';
    addDebugLog(`Unhandled Promise rejection: ${errorMsg}${stack}`, 'error');
  });
})();

start(); 