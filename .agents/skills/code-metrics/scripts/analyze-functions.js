#!/usr/bin/env node

/**
 * analyze-functions.js
 * Analyzes top-level functions or methods in source files (TS/JS) and reports their sizes.
 * Usage: node scripts/analyze-functions.js <path-to-file>
 */

const fs = require('fs');
const path = require('path');

const targetFile = process.argv[2];

if (!targetFile) {
  console.error('Usage: node scripts/analyze-functions.js <path-to-file>');
  process.exit(1);
}

const resolvedPath = path.resolve(process.cwd(), targetFile);

if (!fs.existsSync(resolvedPath)) {
  console.error(`Error: File not found: ${resolvedPath}`);
  process.exit(1);
}

const content = fs.readFileSync(resolvedPath, 'utf8');
const lines = content.split(/\r?\n/);

// Matches functions, async functions, exports, methods, or const/let arrows
const patterns = [
  /^(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_$]+)/,
  /^(?:export\s+)?(?:const|let)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/,
  /^\s*(?:public|private|protected|static|async|\s)*\s*([a-zA-Z0-9_$]+)\s*\([^)]*\)\s*(?::\s*[^;{]+)?\s*\{/
];

const found = [];
let current = null;

lines.forEach((line, idx) => {
  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match && match[1] && !['if', 'for', 'while', 'switch', 'catch', 'constructor'].includes(match[1])) {
      if (current) {
        current.end = idx;
        current.length = current.end - current.start;
        found.push(current);
      }
      current = { name: match[1], start: idx + 1 };
      break;
    }
  }
});

if (current) {
  current.end = lines.length;
  current.length = current.end - current.start;
  found.push(current);
}

found.sort((a, b) => b.length - a.length);

console.log(`\n=== Function breakdown for ${targetFile} (Total: ${lines.length} lines) ===\n`);
if (found.length === 0) {
  console.log('No functions detected with standard signatures.');
} else {
  found.forEach(f => {
    console.log(`${f.name.padEnd(35)} : ${String(f.length).padStart(4)} lignes  (L${f.start} -> L${f.end})`);
  });
}
console.log('');
