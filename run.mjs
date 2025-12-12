#!/usr/bin/env node

/**
 * Cross-platform runner script for Rowbooster
 * Works on Windows, Linux, and macOS
 * Usage: node run.mjs [mode]
 * Modes: dev (default), build, start
 */

import { spawn } from 'child_process';
import { platform } from 'os';

const isWindows = platform() === 'win32';

// Parse command line arguments
const mode = process.argv[2] || 'dev';

// Define commands for each mode
const commands = {
  dev: {
    cmd: isWindows ? 'npx.cmd' : 'npx',
    args: ['tsx', 'server/index.ts'],
    env: { ...process.env, NODE_ENV: 'development' }
  },
  build: {
    cmd: isWindows ? 'npm.cmd' : 'npm',
    args: ['run', 'build'],
    env: process.env
  },
  start: {
    cmd: isWindows ? 'npm.cmd' : 'npm',
    args: ['run', 'start'],
    env: { ...process.env, NODE_ENV: 'production' }
  }
};

// Validate mode
if (!commands[mode]) {
  console.error(`Invalid mode: ${mode}`);
  console.error('Available modes: dev, build, start');
  process.exit(1);
}

const config = commands[mode];

console.log(`🚀 Starting Rowbooster in ${mode} mode...`);
console.log(`Platform: ${platform()}`);
console.log(`Command: ${config.cmd} ${config.args.join(' ')}`);
console.log('');

// Spawn the process
const child = spawn(config.cmd, config.args, {
  stdio: 'inherit',
  env: config.env,
  shell: false
});

// Handle process events
child.on('error', (error) => {
  console.error('Failed to start process:', error);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.log(`Process terminated with signal: ${signal}`);
  } else if (code !== 0) {
    console.error(`Process exited with code: ${code}`);
  }
  process.exit(code || 0);
});

// Handle termination signals
const handleTermination = (signal) => {
  console.log(`\nReceived ${signal}, shutting down gracefully...`);
  child.kill(signal);
};

process.on('SIGINT', () => handleTermination('SIGINT'));
process.on('SIGTERM', () => handleTermination('SIGTERM'));

// On Windows, handle CTRL+C
if (isWindows) {
  process.on('SIGBREAK', () => handleTermination('SIGBREAK'));
}