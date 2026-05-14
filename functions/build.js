const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
const funcDir = __dirname;

console.log('Building Next.js app...');
execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });

const nextDir = path.join(rootDir, '.next');
const funcNextDir = path.join(funcDir, '.next');

if (fs.existsSync(funcNextDir)) {
  fs.rmSync(funcNextDir, { recursive: true });
}

fs.cpSync(nextDir, funcNextDir, { recursive: true });
console.log('Copied .next to functions/');

fs.cpSync(path.join(rootDir, 'public'), path.join(funcDir, 'public'), { recursive: true });
fs.cpSync(path.join(rootDir, 'next.config.js'), path.join(funcDir, 'next.config.js'));
fs.cpSync(path.join(rootDir, 'package.json'), path.join(funcDir, 'package.json'));
fs.cpSync(path.join(rootDir, '.env.local'), path.join(funcDir, '.env.local'), { recursive: true });
fs.cpSync(path.join(rootDir, 'tailwind.config.js'), path.join(funcDir, 'tailwind.config.js'));
fs.cpSync(path.join(rootDir, 'postcss.config.js'), path.join(funcDir, 'postcss.config.js'));

console.log('Build complete!');
