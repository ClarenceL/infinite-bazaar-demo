#!/usr/bin/env node

/**
 * Convenient wrapper for the instance reset tool
 * 
 * This script allows you to run the instance reset tool from the project root
 * without having to remember the full pnpm filter syntax.
 * 
 * Examples:
 *   node reset-instance.js --help
 *   node reset-instance.js --instance=default --preview
 *   node reset-instance.js --all-instances
 */

const { spawn } = require('child_process');
const path = require('path');

// Parse command line arguments (everything after the script name)
const args = process.argv.slice(2);

// If no arguments provided, show usage
if (args.length === 0) {
  console.log('Instance Reset Tool Wrapper');
  console.log('===========================');
  console.log('');
  console.log('Usage: node reset-instance.js [OPTIONS]');
  console.log('');
  console.log('This is a convenient wrapper for the instance reset tool.');
  console.log('Run with --help to see all available options.');
  console.log('');
  console.log('Quick examples:');
  console.log('  node reset-instance.js --help');
  console.log('  node reset-instance.js --instance=default --preview');
  console.log('  node reset-instance.js --instance=default');
  console.log('  node reset-instance.js --all-instances --preview');
  console.log('');
  process.exit(0);
}

// Build the full pnpm command
const pnpmArgs = [
  '--filter', '@infinite-bazaar-demo/db',
  'db:reset-instance',
  ...args
];

console.log(`Running: pnpm ${pnpmArgs.join(' ')}`);
console.log('');

// Execute the command
const child = spawn('pnpm', pnpmArgs, {
  stdio: 'inherit',
  cwd: __dirname
});

child.on('close', (code) => {
  process.exit(code);
});

child.on('error', (error) => {
  console.error('Error executing command:', error.message);
  console.error('Make sure pnpm is installed and available in your PATH');
  process.exit(1);
}); 