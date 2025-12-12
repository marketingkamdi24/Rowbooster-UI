#!/usr/bin/env node

/**
 * Start both Main App and Monitoring System together
 * Both run in a single Render deployment on the same port using path-based routing
 */

import { spawn } from 'child_process';

console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('   🚀 STARTING ROWBOOSTER WITH MONITORING');
console.log('═══════════════════════════════════════════════════════════');
console.log('');

// Single port for both (Render provides this)
const PORT = process.env.PORT || 10000;

console.log(`[LAUNCHER] Starting integrated server on port ${PORT}...`);
console.log(`[LAUNCHER] Main App: /`);
console.log(`[LAUNCHER] Monitoring: /monitoring`);
console.log('');

// Start the integrated server
const server = spawn('node', ['dist/index.js'], {
  env: { ...process.env, PORT },
  stdio: 'inherit',
  shell: true
});

server.on('error', (error) => {
  console.error('[LAUNCHER-ERROR] Server failed:', error);
  process.exit(1);
});

server.on('exit', (code) => {
  console.log(`[LAUNCHER] Server exited with code ${code}`);
  process.exit(code || 0);
});

// Handle shutdown
process.on('SIGTERM', () => {
  console.log('[LAUNCHER] Received SIGTERM, shutting down gracefully...');
  server.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('[LAUNCHER] Received SIGINT, shutting down gracefully...');
  server.kill('SIGINT');
});