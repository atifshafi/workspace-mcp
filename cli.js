#!/usr/bin/env node
// Simple CLI for workspace-mcp: init, start, analyze --dry-run
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKDIR = __dirname;
const CONFIG_PATH = path.join(WORKDIR, 'config.json');

function print(msg){ process.stdout.write(String(msg)+"\n"); }
function error(msg){ process.stderr.write(String(msg)+"\n"); }

function findWorkspaceRoot(){
  // Heuristic: prefer env, else search upward for a .git, else default to $PWD
  const envRoot = process.env.WORKSPACE_MCP_ROOT;
  if (envRoot && fs.existsSync(envRoot)) return envRoot;
  let dir = process.cwd();
  while (dir && dir !== path.dirname(dir)){
    const git = path.join(dir, '.git');
    if (fs.existsSync(git)) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

function scanProjectPatterns(dirPath){
  const patterns = {
    'package.json': 'node',
    'pyproject.toml': 'python', 
    'Cargo.toml': 'rust',
    'go.mod': 'go',
    'pom.xml': 'java',
    'requirements.txt': 'python',
    'setup.py': 'python',
    'src': 'source',
    'tests': 'tests',
    'test': 'tests',
    'docs': 'docs',
    'documentation': 'docs',
    'README.md': 'docs'
  };
  
  const signals = [];
  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const item of items) {
      const name = item.name;
      if (patterns[name]) {
        signals.push(patterns[name]);
      }
    }
  } catch {}
  return [...new Set(signals)]; // dedupe
}

function suggestAppGlobs(workspaceRoot){
  const suggestions = [];
  const commonPatterns = [
    'apps/*', 'packages/*', 'services/*', 'components/*', 'modules/*',
    'src/*', 'lib/*', 'tools/*', 'scripts/*', 'automation/*', 
    'projects/*', 'workspace/*', 'repos/*', 'documentation/*', 'docs/*', 'notes/*'
  ];
  
  try {
    const items = fs.readdirSync(workspaceRoot, { withFileTypes: true });
    const dirs = items.filter(d => d.isDirectory()).map(d => d.name);
    
    for (const dir of dirs) {
      const fullPath = path.join(workspaceRoot, dir);
      const signals = scanProjectPatterns(fullPath);
      
      // Skip common non-app directories
      if (['node_modules', '.git', '.venv', 'dist', 'build', '.cache'].includes(dir)) continue;
      
      // Check if this directory contains apps/projects
      try {
        const subItems = fs.readdirSync(fullPath, { withFileTypes: true });
        const subDirs = subItems.filter(d => d.isDirectory()).map(d => d.name);
        
        // If has multiple subdirs with project signals, suggest as app container
        let appLikeSubdirs = 0;
        for (const subDir of subDirs.slice(0, 10)) { // limit check to first 10
          const subPath = path.join(fullPath, subDir);
          const subSignals = scanProjectPatterns(subPath);
          if (subSignals.length > 0) appLikeSubdirs++;
        }
        
        if (appLikeSubdirs >= 2) {
          suggestions.push(`${dir}/*`);
        } else if (signals.length > 0) {
          // Single project in this dir
          suggestions.push(dir);
        }
      } catch {}
    }
    
    // Add common patterns that exist
    for (const pattern of commonPatterns) {
      const baseDir = pattern.replace('/*', '');
      if (dirs.includes(baseDir) && !suggestions.some(s => s.startsWith(baseDir))) {
        if (pattern.endsWith('/*')) {
          suggestions.push(pattern);
        } else {
          suggestions.push(pattern);
        }
      }
    }
  } catch {}
  
  return suggestions.length > 0 ? suggestions : ['*']; // fallback to scan everything
}

function promptActivityChoice(){
  // Simple sync prompt for activity tracking
  if (!process.stdin.isTTY) {
    // Non-interactive environment, default to false
    print('Enable activity-based promotion (tracks recently used files)? (y/N): N (non-interactive)');
    return Promise.resolve(false);
  }
  
  process.stdout.write('Enable activity-based promotion (tracks recently used files)? (y/N): ');
  process.stdin.setRawMode(true);
  return new Promise((resolve) => {
    process.stdin.once('data', (data) => {
      process.stdin.setRawMode(false);
      const input = data.toString().trim().toLowerCase();
      print(''); // newline
      resolve(input === 'y' || input === 'yes');
    });
  });
}

async function generateConfig(workspaceRoot, interactive = true){
  const suggestedGlobs = suggestAppGlobs(workspaceRoot);
  let activityEnabled = false;
  
  if (interactive) {
    print(`Detected workspace: ${workspaceRoot}`);
    print(`Suggested app patterns: ${suggestedGlobs.join(', ')}`);
    activityEnabled = await promptActivityChoice();
  }
  
  const config = {
    workspaceRoot,
    appGlobs: suggestedGlobs,
    ignore: [
      '**/node_modules/**','**/.git/**','**/.venv/**','**/.mypy_cache/**',
      '**/dist/**','**/build/**','**/.next/**','**/.turbo/**','**/.cache/**',
      '**/coverage/**','**/__snapshots__/**','**/.pytest_cache/**',
      '**/*.png','**/*.jpg','**/*.jpeg','**/*.gif','**/*.mp4','**/*.zip',
      '**/*.log','**/logs/**','**/tmp/**'
    ],
    queue: { 
      maxConcurrentSummaries: 3, 
      summariesPerMinute: 3, 
      debounceMs: 750, 
      priorityPaths: [] 
    },
    purpose: {
      limits: { maxFiles: 25, maxBytes: 350000, chunkTokens: 3000, timeoutMs: 8000 },
      gitRepoOverrides: { maxFiles: 50, maxBytes: 800000, chunkTokens: 3800, timeoutMs: 12000 }
    },
    activity: { 
      enable: activityEnabled, 
      sources: { cursorIde: true, cursorSessions: true, fsMtime: true }, 
      promote: { minScore: 3.0, maxPerRoot: 20, depthLimit: 2 } 
    }
  };
  return config;
}

async function writeConfigSafe(cfg){
  if (fs.existsSync(CONFIG_PATH)) {
    print(`config.json already exists at ${CONFIG_PATH} — not overwriting.`);
    return false;
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
  print(`Wrote config.json to ${CONFIG_PATH}`);
  return true;
}

async function analyzeDryRun(workspaceRoot){
  const items = fs.readdirSync(workspaceRoot, { withFileTypes: true });
  const dirs = items.filter(d=>d.isDirectory()).map(d=>d.name);
  const analysis = [];
  
  for (const d of dirs){
    const full = path.join(workspaceRoot, d);
    const signals = scanProjectPatterns(full);
    try {
      const subDirCount = fs.readdirSync(full, { withFileTypes: true }).filter(x=>x.isDirectory()).length;
      analysis.push({ dir: d, signals, subDirs: subDirCount });
    } catch {
      analysis.push({ dir: d, signals, subDirs: 0 });
    }
  }
  
  const suggestedGlobs = suggestAppGlobs(workspaceRoot);
  const report = { 
    workspaceRoot, 
    dirsAnalyzed: dirs.length, 
    analysis,
    suggestions: { appGlobs: suggestedGlobs } 
  };
  print(JSON.stringify(report, null, 2));
}

async function startServer(){
  const child = spawn('node', [path.join(WORKDIR, 'index.js')], { stdio: 'inherit' });
  child.on('exit', (code)=> process.exit(code ?? 0));
}

async function main(){
  const cmd = process.argv[2] || 'help';
  if (cmd === 'init'){
    const root = process.env.WORKSPACE_MCP_ROOT || findWorkspaceRoot();
    const cfg = await generateConfig(root, true);
    await writeConfigSafe(cfg);
    return;
  }
  if (cmd === 'start'){
    await startServer();
    return;
  }
  if (cmd === 'analyze' && process.argv.includes('--dry-run')){
    const root = process.env.WORKSPACE_MCP_ROOT || findWorkspaceRoot();
    await analyzeDryRun(root);
    return;
  }
  print(`workspace-mcp CLI
Usage:
  npx workspace-mcp init            # generates config.json (no overwrite)
  npx workspace-mcp start           # starts the MCP server
  npx workspace-mcp analyze --dry-run  # prints suggested globs and workspace signals
Env:
  WORKSPACE_MCP_ROOT=/abs/path  # override detected root
`);
}

main().catch(e=>{ error(e?.stack||String(e)); process.exit(1); });


