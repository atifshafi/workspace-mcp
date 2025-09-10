#!/usr/bin/env node
// Test script for AI summarization integration
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

async function execCommand(command, args, input, timeoutMs = 20000){
  return new Promise((resolve) => {
    try {
      const child = spawn(command, args, { stdio: ['pipe','pipe','pipe'] });
      let out = '', err = '';
      const t = setTimeout(() => { try { child.kill(); } catch {} }, timeoutMs);
      child.stdout.on('data', d => out += String(d));
      child.stderr.on('data', d => err += String(d));
      child.on('error', (e) => {
        clearTimeout(t);
        resolve({ out: null, err: String(e), code: -1 });
      });
      child.on('exit', (code) => { 
        clearTimeout(t); 
        resolve({ out: out?.trim() || null, err: err?.trim() || null, code });
      });
      if (input) child.stdin.write(input);
      child.stdin.end();
    } catch (e) { resolve({ out: null, err: String(e), code: -1 }); }
  });
}

async function testGeminiCli(){
  console.log('🧪 Testing Gemini CLI Integration\n');
  
  // Check environment
  console.log('📋 Environment Check:');
  console.log(`  GOOGLE_API_KEY: ${process.env.GOOGLE_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`  WORKSPACE_MCP_GEMINI_CLI: ${process.env.WORKSPACE_MCP_GEMINI_CLI || 'gemini (default)'}`);
  console.log(`  WORKSPACE_MCP_GEMINI_MODEL: ${process.env.WORKSPACE_MCP_GEMINI_MODEL || 'gemini-1.5-flash (default)'}`);
  console.log(`  WORKSPACE_MCP_AI: ${process.env.WORKSPACE_MCP_AI || 'enabled (default)'}`);
  console.log();

  // Test bundled Python wrapper (most robust)
  const pythonWrapper = path.join(process.cwd(), 'gemini_cli.py');
  console.log(`🔍 Testing bundled Python wrapper: ${pythonWrapper}`);
  
  if (!fs.existsSync(pythonWrapper)) {
    console.log('❌ Python wrapper not found');
    return;
  }
  
  const model = process.env.WORKSPACE_MCP_GEMINI_MODEL || 'gemini-1.5-flash';
  const testPrompt = 'Summarize this in one sentence: This is a Node.js MCP server for workspace analysis.';
  
  console.log(`🚀 Testing generation with model: ${model}`);
  console.log(`   Prompt: ${testPrompt}`);
  
  const args = ['python3', pythonWrapper, '--model', model, '--prompt', testPrompt];
  console.log(`   Command: ${args.join(' ')}`);
  
  const result = await execCommand('python3', [pythonWrapper, '--model', model, '--prompt', testPrompt], null, 15000);
  console.log(`   Exit code: ${result.code}`);
  
  if (result.out) {
    console.log('✅ Generation successful!');
    console.log(`   Response: ${result.out}`);
  } else {
    console.log('❌ Generation failed');
    if (result.err) console.log(`   Error: ${result.err}`);
  }
  console.log();
}

async function testFullWorkflow(){
  console.log('🔄 Testing Full AI Workflow\n');
  
  // Import the actual functions (simplified version)
  const testSnippets = [
    { path: 'package.json', text: '{"name": "workspace-mcp", "description": "MCP server for workspace analysis"}' },
    { path: 'index.js', text: 'import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";\n// Main MCP server implementation' }
  ];
  
  console.log('📝 Test snippets prepared:');
  testSnippets.forEach(s => console.log(`   ${s.path}: ${s.text.slice(0, 60)}...`));
  console.log();
  
  // Test the same logic as tryGeminiCli
  const disabled = (process.env.WORKSPACE_MCP_AI === 'disabled') || (process.env.WORKSPACE_MCP_AI_DISABLE === '1');
  if (disabled) {
    console.log('❌ AI is disabled via environment variables');
    return;
  }
  
  if (!process.env.GOOGLE_API_KEY) {
    console.log('❌ GOOGLE_API_KEY not set');
    return;
  }
  
  const pythonWrapper = path.join(process.cwd(), 'gemini_cli.py');
  const model = process.env.WORKSPACE_MCP_GEMINI_MODEL || 'gemini-1.5-flash';
  const prompt = `Summarize this app as a single sentence purpose. Return only the sentence. Files:` +
    testSnippets.map(s=>`\n### ${path.basename(s.path)}\n${s.text}`).join('\n');
  
  console.log('🎯 Full workflow test:');
  console.log(`   Using: python3 ${pythonWrapper}`);
  const result = await execCommand('python3', [pythonWrapper, '--model', model, '--prompt', prompt], null, 20000);
  
  if (result.out) {
    console.log('✅ Full workflow successful!');
    console.log(`   AI Summary: "${result.out}"`);
    console.log(`   Confidence: 0.8 (simulated)`);
  } else {
    console.log('❌ Full workflow failed');
    if (result.err) console.log(`   Error: ${result.err}`);
  }
}

async function main(){
  console.log('🧪 Workspace MCP AI Integration Test\n');
  console.log('=' .repeat(50));
  
  await testGeminiCli();
  console.log('=' .repeat(50));
  await testFullWorkflow();
  console.log('=' .repeat(50));
  
  console.log('\n💡 Next steps:');
  console.log('   1. If tests pass: Start MCP server with `npx workspace-mcp start`');
  console.log('   2. Use `workspace.bootstrap` tool to see AI summaries in action');
  console.log('   3. Check `cache/telemetry.log` for AI adapter usage logs');
}

main().catch(e => {
  console.error('Test failed:', e);
  process.exit(1);
});
