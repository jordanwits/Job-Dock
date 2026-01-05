#!/usr/bin/env node

/**
 * Simple test script to validate the MCP server can start and respond to basic requests
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Testing JobDock AWS MCP Server...\n');

// Start the server
const serverPath = join(__dirname, 'dist', 'server.js');
const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'inherit'],
  env: {
    ...process.env,
    AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  },
});

let timeout;

// Send a tools/list request
const listToolsRequest = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/list',
  params: {},
}) + '\n';

server.stdin.write(listToolsRequest);

// Collect response
let responseData = '';
server.stdout.on('data', (data) => {
  responseData += data.toString();
  
  // Try to parse JSON response
  const lines = responseData.split('\n');
  for (const line of lines) {
    if (line.trim() && line.includes('"result"')) {
      try {
        const response = JSON.parse(line);
        if (response.result && response.result.tools) {
          console.log('✓ Server started successfully');
          console.log(`✓ Found ${response.result.tools.length} tools:\n`);
          
          response.result.tools.forEach((tool) => {
            console.log(`  - ${tool.name}`);
          });
          
          console.log('\n✓ MCP server is working correctly!');
          console.log('\nYou can now configure it in your editor.');
          
          clearTimeout(timeout);
          server.kill();
          process.exit(0);
        }
      } catch (e) {
        // Not valid JSON yet, continue collecting
      }
    }
  }
});

server.on('error', (error) => {
  console.error('✗ Failed to start server:', error.message);
  process.exit(1);
});

server.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`✗ Server exited with code ${code}`);
    process.exit(1);
  }
});

// Timeout after 10 seconds
timeout = setTimeout(() => {
  console.error('✗ Server did not respond within 10 seconds');
  server.kill();
  process.exit(1);
}, 10000);

