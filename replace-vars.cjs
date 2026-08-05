/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const path = require('path');

const cssVars = {
  '#0078d4': 'var(--chat-primary)',
  '#106ebe': 'var(--chat-primary-hover)',
  '#ffffff': 'var(--chat-bg)',
  '#fff': 'var(--chat-bg)',
  '#f5f5f5': 'var(--chat-bg-secondary)',
  '#f3f4f6': 'var(--chat-bg-secondary)',
  '#f5f6f8': 'var(--chat-bg-secondary)',
  '#e5f6ff': 'var(--chat-message-own-bg)',
  '#e1f5fe': 'var(--chat-message-own-bg)',
  '#242424': 'var(--chat-text)',
  '#111b21': 'var(--chat-text)',
  '#1f2937': 'var(--chat-text)',
  '#616161': 'var(--chat-text-secondary)',
  '#6b7280': 'var(--chat-text-secondary)',
  '#667781': 'var(--chat-text-secondary)',
  '#9ca3af': 'var(--chat-text-secondary)',
  '#e0e0e0': 'var(--chat-border)',
  '#e1e4e8': 'var(--chat-border)',
  '#e5e7eb': 'var(--chat-border)',
  '14px': 'var(--chat-font-size)',
  '8px': 'var(--chat-radius)',
  '12px': 'var(--chat-radius-message)',
  '16px': 'var(--chat-spacing-md)',
  '4px': 'var(--chat-spacing-xs)',
};

function walkDir(dir) {
  let files = [];
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      files = files.concat(walkDir(fullPath));
    } else if (fullPath.endsWith('.scss')) {
      files.push(fullPath);
    }
  });
  return files;
}

const scssFiles = walkDir('./src/components');
scssFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  Object.keys(cssVars).forEach(key => {
    if (key.startsWith('#')) {
      const hexRegex = new RegExp(key + '(?![a-fA-F0-9])', 'gi');
      if (hexRegex.test(content)) {
        content = content.replace(hexRegex, cssVars[key]);
        changed = true;
      }
    } else {
       const pxRegex = new RegExp(`\\b${key}\\b`, 'g');
       if (pxRegex.test(content)) {
         content = content.replace(pxRegex, cssVars[key]);
         changed = true;
       }
    }
  });
  if (changed) {
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
});
