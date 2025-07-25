#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// 启动主应用
const mainScript = path.join(__dirname, '..', 'index.js');
const child = spawn('node', [mainScript], {
  stdio: 'inherit',
  cwd: process.cwd()
});

child.on('error', (error) => {
  console.error('启动失败:', error);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code);
});