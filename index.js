#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import chokidar from 'chokidar';
import fs from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import fg from 'fast-glob';
import picomatch from 'picomatch';
import lunr from 'lunr';
import Fuse from 'fuse.js';
import toml from 'toml';
// --- Git detection ---
function isInsideGitRepo(appPath) {
  try {
    let dir = appPath;
    while (dir && dir !== path.dirname(dir)) {
      if (fs.existsSync(path.join(dir, '.git'))) return true;
      dir = path.dirname(dir);
    }
  } catch {}
  return false;
}

// --- Metadata management (non-git only) ---
async function ensureMetadataFile(appPath) {
  const metaPath = path.join(appPath, '.capsule.json');
  if (fs.existsSync(metaPath)) return;
  const meta = {
    schema: 1,
    intended_role: 'mixed',
    purpose_hint: '',
    important_paths: [],
    entrypoints: [],
    indexing: { include: ['**/*.{py,ts,tsx,md,json}'], exclude: ['**/node_modules/**','**/.git/**','**/.cache/**'] },
    logs: { include: [], tail_lines: 0 },
    ai: { mode: 'ai', budget: PURPOSE_LIMITS.limits },
    owners: [],
    tags: [],
    updated_at: new Date().toISOString(),
  };
  const tmp = metaPath + `.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(meta, null, 2), { mode: 0o600 });
  try { fs.renameSync(tmp, metaPath); } catch { try { fs.unlinkSync(tmp); } catch {} }
}

// --- AI summarization adapter (enabled by default; can be disabled via env) ---
async function collectRepresentativeSnippets(appPath, limits){
  const maxFiles = Math.max(1, Math.min(10, limits.maxFiles||10));
  const files = listCodeFiles(appPath).slice(0, maxFiles);
  const snippets = [];
  for (const f of files.slice(0, 8)){
    try {
      const text = isLargeFile(f) ? readLargeFileSummary(f) : fs.readFileSync(f,'utf8');
      snippets.push({ path: f, text: text.slice(0, 2000) });
    } catch {}
  }
  return snippets;
}

async function execCommand(command, args, input, timeoutMs = 20000){
  return new Promise((resolve) => {
    try {
      const child = spawn(command, args, { stdio: ['pipe','pipe','pipe'] });
      let out = '', err = '';
      const t = setTimeout(() => { try { child.kill(); } catch {} }, timeoutMs);
      child.stdout.on('data', d => out += String(d));
      child.stderr.on('data', d => err += String(d));
      child.on('exit', () => { clearTimeout(t); resolve(out?.trim() || null); });
      if (input) child.stdin.write(input);
      child.stdin.end();
    } catch { resolve(null); }
  });
}

async function tryGeminiCli(appPath, limits){
  try {
    const disabled = (process.env.WORKSPACE_MCP_AI === 'disabled') || (process.env.WORKSPACE_MCP_AI_DISABLE === '1');
    if (disabled) return null;
    
    // Check if Gemini API key is available
    if (!process.env.GOOGLE_API_KEY) return null;
    
    const cmd = process.env.WORKSPACE_MCP_GEMINI_CLI || 'gemini';
    const model = process.env.WORKSPACE_MCP_GEMINI_MODEL || 'gemini-1.5-flash';
    const argsTpl = process.env.WORKSPACE_MCP_GEMINI_ARGS; // e.g., "-m {MODEL} generate -p {PROMPT}"
    const snippets = await collectRepresentativeSnippets(appPath, limits);
    if (snippets.length === 0) return null;
    const prompt = `Summarize this app as a single sentence purpose. Return only the sentence. Files:` +
      snippets.map(s=>`\n### ${path.basename(s.path)}\n${s.text}`).join('\n');
    let args;
    if (argsTpl) {
      args = argsTpl
        .replaceAll('{MODEL}', model)
        .replaceAll('{PROMPT}', prompt)
        .split(' ');
    } else {
      // Default assumption for a gemini CLI: gemini -m <model> generate -p <prompt>
      args = ['-m', model, 'generate', '-p', prompt];
    }
    const result = await execCommand(cmd, args, null, 25000);
    const text = result?.trim();
    if (text) {
      return { purpose: text, role: 'mixed', confidence: 0.8, evidence_paths: snippets.map(s=>s.path).slice(0,5) };
    }
  } catch {}
  return null;
}

async function externalSummarizeApp(appPath, limits){
  try {
    const disabled = (process.env.WORKSPACE_MCP_AI === 'disabled') || (process.env.WORKSPACE_MCP_AI_DISABLE === '1');
    if (disabled) return null;
    // Priority 1: Gemini CLI
    const gemini = await tryGeminiCli(appPath, limits);
    if (gemini) return gemini;

    // Priority 2: OpenAI Chat Completions if API key present
    if (process.env.OPENAI_API_KEY){
      const model = process.env.WORKSPACE_MCP_AI_MODEL || 'gpt-4o-mini';
      const snippets = await collectRepresentativeSnippets(appPath, limits);
      if (snippets.length === 0) return null;
      const prompt = `Summarize this app as a single sentence purpose. Return only the sentence. Files: ` +
        snippets.map(s=>`\n### ${path.basename(s.path)}\n${s.text}`).join('\n');
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type':'application/json', 'authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({ model, messages: [ { role: 'system', content: 'You are a concise software documentation assistant.' }, { role: 'user', content: prompt } ], temperature: 0.2 })
      });
      if (res.ok){
        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content?.trim();
        if (content){
          return { purpose: content, role: 'mixed', confidence: 0.8, evidence_paths: snippets.map(s=>s.path).slice(0,5) };
        }
      }
    }

    // Priority 3: Generic HTTP endpoint (optional)
    const endpoint = process.env.WORKSPACE_MCP_AI_ENDPOINT;
    if (endpoint){
      const snippets = await collectRepresentativeSnippets(appPath, limits);
      if (snippets.length === 0) return null;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(process.env.WORKSPACE_MCP_AI_AUTH ? { 'authorization': process.env.WORKSPACE_MCP_AI_AUTH } : {}) },
        body: JSON.stringify({ app: appPath, snippets, limits })
      });
      if (res.ok){
        const data = await res.json();
        if (data && (data.purpose || data.summary)){
          return {
            purpose: data.purpose || data.summary,
            role: data.role || 'mixed',
            confidence: data.confidence ?? 0.7,
            evidence_paths: snippets.map(s=>s.path).slice(0,5)
          };
        }
      }
    }
  } catch {}
  return null; // fall back to local
}

async function aiSummarizeApp(appPath, limits) {
  // Default: try external adapter unless disabled; fall back to local heuristic
  const external = await externalSummarizeApp(appPath, limits);
  if (external) return external;
  const files = listCodeFiles(appPath).slice(0, Math.max(1, Math.min(10, limits.maxFiles||10)));
  const evidence_paths = files.slice(0, 5);
  const purpose = `Workspace unit ${path.basename(appPath)} summarized from ${evidence_paths.length} files`;
  return { purpose, role: 'mixed', confidence: 0.6, evidence_paths };
}

const CONFIG_PATH = path.resolve(path.dirname(new URL(import.meta.url).pathname), 'config.json');
const DEFAULT_WORKSPACE_ROOT = '/Users/ashafi/Documents/work';

function readConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const cfg = JSON.parse(raw);
    return cfg;
  } catch {
    return {
      workspaceRoot: DEFAULT_WORKSPACE_ROOT,
      appGlobs: ['ai/ai_systems/apps/*'],
      ignore: [
        '**/node_modules/**','**/.git/**','**/.venv/**','**/.mypy_cache/**',
        '**/dist/**','**/build/**','**/.next/**','**/.turbo/**','**/.cache/**',
        '**/coverage/**','**/__snapshots__/**','**/.pytest_cache/**',
        '**/*.png','**/*.jpg','**/*.jpeg','**/*.gif','**/*.mp4','**/*.zip'
      ]
    };
  }
}

const config = readConfig();
const WORKSPACE_ROOT = config.workspaceRoot;
const CACHE_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), 'cache');
function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }
ensureDir(CACHE_DIR);
const HOME_DIR = process.env.HOME || process.env.USERPROFILE || '';

const server = new McpServer({ name: 'Workspace MCP', version: '0.1.0' }, { capabilities: { tools: {}, logging: {} } });

const state = {
  appCapsules: new Map(), // appPath -> capsule object
  lastIndexedAt: null,
  appsIndexed: new Set(),
  appLunr: new Map(), // appPath -> { index, documents }
  // Job system
  jobQueue: [], // [{ appPath, priority, reason, enqueuedAt }]
  enqueued: new Set(), // to avoid duplicates
  activeJobs: 0,
  // Rate limiting
  dripTokens: 0,
  lastDripRefill: Date.now(),
};

// Purpose/AI budgets (defaults; can be overridden by config)
const PURPOSE_LIMITS = Object.assign({
  limits: { maxFiles: 25, maxBytes: 350000, chunkTokens: 3000, timeoutMs: 8000 },
  gitRepoOverrides: { maxFiles: 50, maxBytes: 800000, chunkTokens: 3800, timeoutMs: 12000 },
}, (config.purpose || {}));

// Queue configuration (tunable; overridable via config.queue)
const QUEUE_CONFIG = Object.assign({
  maxConcurrentSummaries: 3, // parallel workers
  summariesPerMinute: 3,     // drip rate
  debounceMs: 750,           // per-app debounce window
  priorityPaths: ['/Users/ashafi/Documents/work/ai/ai_systems/apps'],
}, (config.queue || {}));

// Per-app debounce tracking
const debounceTimers = new Map(); // appPath -> timeout id

function calculatePriority(appPath) {
  // Priority: 1 (priorityPaths) > 2 (default)
  for (const p of QUEUE_CONFIG.priorityPaths) {
    if (appPath.startsWith(p)) return 1;
  }
  return 2;
}

function enqueueApp(appPath, reason = 'watch', priority) {
  const pr = priority ?? calculatePriority(appPath);
  if (!state.enqueued.has(appPath)) {
    state.jobQueue.push({ appPath, priority: pr, reason, enqueuedAt: Date.now() });
    state.enqueued.add(appPath);
    // keep queue sorted by priority then time
    state.jobQueue.sort((a, b) => (a.priority - b.priority) || (a.enqueuedAt - b.enqueuedAt));
  }
}

function refillDripTokens() {
  const now = Date.now();
  const elapsed = now - state.lastDripRefill;
  if (elapsed >= 60_000) {
    state.dripTokens = QUEUE_CONFIG.summariesPerMinute;
    state.lastDripRefill = now;
  }
}

async function processOne(job) {
  try {
    // Decide budgets based on Git awareness
    const inGit = isInsideGitRepo(job.appPath);
    const limits = inGit ? PURPOSE_LIMITS.gitRepoOverrides : PURPOSE_LIMITS.limits;

    // Ensure metadata only for non-git paths
    if (!inGit) {
      try { await ensureMetadataFile(job.appPath); } catch {}
    }

    // Compute/update capsule via AI summarization (fallback to heuristic on error)
    let capsule;
    try {
      const ai = await aiSummarizeApp(job.appPath, limits);
      capsule = Object.assign({}, summarizeApp(job.appPath), {
        purpose: ai.purpose || 'Unknown',
        ai: { role: ai.role || null, confidence: ai.confidence || null, evidence_paths: ai.evidence_paths || [] },
      });
    } catch (e) {
      // Fallback to heuristic summarizeApp
      capsule = summarizeApp(job.appPath);
    }
    state.appCapsules.set(job.appPath, capsule);
    try {
      const p = capsuleCachePath(job.appPath);
      fs.writeFileSync(p, JSON.stringify(capsule, null, 2), 'utf8');
    } catch {}
  } catch (e) {
    logTelemetry({ type: 'job_error', app: job.appPath, error: String(e) });
  }
}

function pumpQueue() {
  refillDripTokens();
  while (
    state.activeJobs < QUEUE_CONFIG.maxConcurrentSummaries &&
    state.dripTokens > 0 &&
    state.jobQueue.length > 0
  ) {
    const job = state.jobQueue.shift();
    state.enqueued.delete(job.appPath);
    state.activeJobs += 1;
    state.dripTokens -= 1;
    Promise.resolve(processOne(job))
      .catch(() => {})
      .finally(() => { state.activeJobs -= 1; });
  }
}

// ---------------- Activity-driven sub-app promotion ----------------
function readTextSafe(p){ try { return fs.readFileSync(p,'utf8'); } catch { return null; } }
function extractWorkspacePaths(text){
  if (!text) return [];
  const esc = WORKSPACE_ROOT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = new RegExp(esc+"[^\"\n\r\s]*", 'g');
  const out = new Set(); let m;
  while ((m = rx.exec(text))) out.add(m[0]);
  return Array.from(out);
}
function getCursorIdePaths(){
  const p = path.join(HOME_DIR, '.cursor', 'ide_state.json');
  return extractWorkspacePaths(readTextSafe(p));
}
function getCursorSessionPaths(){
  const dir = path.join(HOME_DIR, '.cursor-sessions');
  const out = new Set();
  try {
    const files = fs.readdirSync(dir).filter(f=>f.endsWith('.session'));
    for (const f of files){
      const t = readTextSafe(path.join(dir,f));
      for (const p of extractWorkspacePaths(t)) out.add(p);
    }
  } catch {}
  return Array.from(out);
}
function bucketFor(pth, root, depthLimit=2){
  if (!pth.startsWith(root)) return null;
  const rel = path.relative(root, pth);
  if (!rel) return root;
  const parts = rel.split(path.sep).filter(Boolean);
  const take = Math.min(parts.length, depthLimit);
  return path.join(root, ...parts.slice(0, take));
}
function recentFsBuckets(root, days=7, depthLimit=2, maxEntries=2000){
  const cutoff = Date.now() - days*24*60*60*1000;
  const buckets = new Map(); let scanned=0;
  function walk(dir, depth){
    if (scanned>maxEntries) return;
    let entries=[]; try{ entries=fs.readdirSync(dir,{withFileTypes:true}); }catch{ return; }
    for (const ent of entries){
      const full = path.join(dir, ent.name);
      if (isIgnored(full)) continue;
      try{
        const st = fs.statSync(full);
        if (ent.isDirectory()){
          if (depth<depthLimit+2) walk(full, depth+1);
        } else if (st.mtimeMs >= cutoff){
          scanned++;
          const b = bucketFor(full, root, depthLimit);
          if (b) buckets.set(b, (buckets.get(b)||0)+1);
        }
      }catch{}
      if (scanned>maxEntries) break;
    }
  }
  walk(root,0);
  return buckets;
}
function buildActivityHeatmap(){
  const sources = Object.assign({ cursorIde:true, cursorSessions:true, fsMtime:true }, (config.activity?.sources||{}));
  const depthLimit = (config.activity?.promote?.depthLimit ?? 2);
  const weights = { cursorIde: 1.0, cursorSessions: 0.8, fsMtime: 0.5 };
  const heat = new Map();
  const roots = listAppRoots();
  function addPaths(paths, w){
    for (const p of paths){
      const r = roots.find(x=>p.startsWith(x));
      if (!r) continue;
      const b = bucketFor(p, r, depthLimit);
      if (!b) continue;
      heat.set(b, (heat.get(b)||0)+w);
    }
  }
  if (sources.cursorIde) addPaths(getCursorIdePaths(), weights.cursorIde);
  if (sources.cursorSessions) addPaths(getCursorSessionPaths(), weights.cursorSessions);
  if (sources.fsMtime){
    for (const r of roots){
      const m = recentFsBuckets(r, 7, depthLimit);
      for (const [b,c] of m.entries()) heat.set(b, (heat.get(b)||0)+c*weights.fsMtime);
    }
  }
  return heat;
}
function scheduleActivityPromotions(){
  if (config.activity?.enable === false) return;
  const minScore = (config.activity?.promote?.minScore ?? 3.0);
  const maxPerRoot = (config.activity?.promote?.maxPerRoot ?? 20);
  const roots = listAppRoots();
  const heat = buildActivityHeatmap();
  for (const r of roots){
    const cand = Array.from(heat.entries()).filter(([b,s])=> b.startsWith(r) && b!==r && s>=minScore);
    cand.sort((a,b)=> b[1]-a[1]);
    for (const [b] of cand.slice(0, maxPerRoot)) enqueueApp(b, 'promote', calculatePriority(b));
  }
}

function isIgnored(p) {
  const isMatch = picomatch(config.ignore || []);
  return isMatch(p);
}

// Cache helpers and guards
function capsuleCachePath(appPath) {
  const safe = Buffer.from(appPath).toString('hex');
  return path.join(CACHE_DIR, `capsule_${safe}.json`);
}
function loadCapsule(appPath) {
  try {
    const p = capsuleCachePath(appPath);
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {}
  return null;
}
function guardPathWithinWorkspace(targetPath) {
  const abs = path.resolve(targetPath);
  const rootAbs = path.resolve(WORKSPACE_ROOT);
  if (!abs.startsWith(rootAbs)) throw new Error('path outside workspace root');
  return abs;
}
function isLargeFile(p) { try { const st = fs.statSync(p); return st.isFile() && st.size > 200*1024; } catch { return false; } }
function readLargeFileSummary(p, maxHeadLines = 200) {
  const text = fs.readFileSync(p, 'utf8');
  const lines = text.split(/\r?\n/);
  const head = lines.slice(0, maxHeadLines);
  const sigs = lines.filter(l => /(class |def |export |function |type |interface |route|router|schema)/i.test(l)).slice(0, 200);
  return [...head, '...', ...sigs].join('\n');
}
function listCodeFilesWithLogs(appPath, limit = 5000) {
  // Logs disabled per config: exclude .log files
  const patterns = ['**/*.{ts,tsx,js,py,md,json,txt}'];
  const files = fg.sync(patterns, { cwd: appPath, ignore: config.ignore || ['**/node_modules/**'], absolute: true, dot: true });
  return files.slice(0, limit);
}
function readLogTailSummary(p, maxTailLines = 1000, maxBytes = 200*1024) {
  try {
    const stat = fs.statSync(p);
    if (stat.size > maxBytes) {
      const fd = fs.openSync(p, 'r');
      const start = Math.max(0, stat.size - maxBytes);
      const buf = Buffer.allocUnsafe(stat.size - start);
      fs.readSync(fd, buf, 0, buf.length, start);
      fs.closeSync(fd);
      const text = buf.toString('utf8');
      const lines = text.split(/\r?\n/);
      return lines.slice(-maxTailLines).join('\n');
    } else {
      const text = fs.readFileSync(p, 'utf8');
      const lines = text.split(/\r?\n/);
      return lines.slice(-maxTailLines).join('\n');
    }
  } catch {
    return '';
  }
}
function listCodeFiles(appPath, limit = 5000) {
  // Legacy alias retained; include logs/text by default
  return listCodeFilesWithLogs(appPath, limit);
}
function buildLunrForApp(appPath) {
  const docs = [];
  const files = listCodeFiles(appPath);
  for (const f of files) {
    try {
      const text = isLargeFile(f) ? readLargeFileSummary(f) : fs.readFileSync(f, 'utf8');
      docs.push({ id: f, path: f, text });
    } catch {}
  }
  const idx = lunr(function() {
    this.ref('id'); this.field('path'); this.field('text');
    for (const d of docs) this.add(d);
  });
  state.appLunr.set(appPath, { index: idx, documents: new Map(docs.map(d => [d.id, d])) });
}
async function embed(text) {
  try {
    const { pipeline } = await import('@xenova/transformers');
    if (!embed._model) embed._model = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    const output = await embed._model(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  } catch { return null; }
}
function cosineSim(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot=0, na=0, nb=0; for (let i=0;i<a.length;i++){ dot+=a[i]*b[i]; na+=a[i]*a[i]; nb+=b[i]*b[i]; }
  if (!na || !nb) return 0; return dot / (Math.sqrt(na)*Math.sqrt(nb));
}
function isTestPath(p){ return /(^|\/)tests?\//.test(p) || /\.(spec|test)\./.test(p); }
function isEntrypointPath(p){ return /(\/src\/.*(main|cli|server|app|index)\.|package\.json$)/.test(p); }
function logTelemetry(entry){ try{ fs.appendFileSync(path.join(CACHE_DIR,'telemetry.log'), JSON.stringify({ t:new Date().toISOString(), ...entry })+'\n','utf8'); } catch{} }

function listAppRoots() {
  const results = new Set();
  for (const pattern of config.appGlobs || []) {
    const matches = fg.sync(pattern, { cwd: WORKSPACE_ROOT, onlyDirectories: true, absolute: true, dot: true, ignore: config.ignore || [] });
    for (const m of matches) results.add(m);
  }
  return Array.from(results);
}

function listAppCandidates() {
  const apps = listAppRoots();
  return apps.map(p => ({ path: p, name: path.basename(p), rel: path.relative(WORKSPACE_ROOT, p) }));
}

function summarizeApp(appPath) {
  // Build a small capsule: purpose, key modules, entrypoints, docs, owners (placeholder)
  function readTextSafe(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }
  function cleanSummary(text, maxLen = 140) {
    if (!text) return null;
    const stripped = text
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[[^\]]*\]\([^)]*\)/g, '$1')
      .replace(/^#+\s*/gm, '')
      .replace(/>\s?/g, '')
      .replace(/\*\*?|__|~~|\*|_/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return stripped.length > maxLen ? stripped.slice(0, maxLen - 1) + '…' : stripped;
  }
  function extractPurposeFromReadme(appPath) {
    const readme = ['README.md','readme.md','Readme.md']
      .map(n => path.join(appPath, n))
      .find(p => fs.existsSync(p));
    const raw = readTextSafe(readme);
    if (!raw) return null;
    const withoutTitle = raw.replace(/^#.+\n+/, '');
    const firstPara = (withoutTitle.split(/\n\s*\n/).find(p => p.trim().length > 30) || '').trim();
    return cleanSummary(firstPara);
  }
  function extractPurposeFromDocs(appPath) {
    const docsDir = path.join(appPath, 'docs');
    if (!fs.existsSync(docsDir)) return null;
    const candidates = ['README.md','OVERVIEW.md','ARCHITECTURE.md','MODULES.md','RUNBOOK.md','DECISIONS.md']
      .map(n => path.join(docsDir, n))
      .filter(p => fs.existsSync(p));
    for (const p of candidates) {
      const firstPara = (readTextSafe(p) || '').split(/\n\s*\n/).find(s => s.trim().length > 30);
      const cleaned = cleanSummary(firstPara);
      if (cleaned) return cleaned;
    }
    return null;
  }
  function extractPurposeFromMetadata(appPath) {
    const pkg = path.join(appPath, 'package.json');
    const pkgText = readTextSafe(pkg);
    if (pkgText) { try { const json = JSON.parse(pkgText); if (json.description) return cleanSummary(json.description); } catch {} }
    const pyproj = path.join(appPath, 'pyproject.toml');
    const pyText = readTextSafe(pyproj);
    if (pyText) { try { const data = toml.parse(pyText); const desc = (data?.project?.description) || (data?.tool?.poetry?.description); if (desc) return cleanSummary(desc); } catch {} }
    return null;
  }
  function extractPurpose(appPath) {
    return (
      extractPurposeFromReadme(appPath) ||
      extractPurposeFromDocs(appPath) ||
      extractPurposeFromMetadata(appPath) ||
      'Unknown'
    );
  }
  const docs = [];
  const possibleDocs = ['README.md','ARCHITECTURE.md', 'MODULES.md', 'RUNBOOK.md', 'DECISIONS.md', 'DOMAIN-GLOSSARY.md'];
  const docsDir = path.join(appPath, 'docs');
  if (fs.existsSync(docsDir)) {
    for (const f of possibleDocs) {
      const p = path.join(docsDir, f);
      if (fs.existsSync(p)) docs.push(p);
    }
  }

  // Entry points: look for common patterns (cli files, main, server)
  const patterns = ['**/src/**/main.*', '**/src/**/cli.*', '**/src/**/server.*', '**/src/**/app.*', '**/src/**/index.*'];
  let entrypoints = [];
  try {
    entrypoints = fg.sync(patterns, { cwd: appPath, ignore: ['**/node_modules/**'], absolute: true, dot: true }).slice(0, 10);
  } catch (e) { /* ignore */ }

  // Key modules: top-level src files
  const srcDir = path.join(appPath, 'src');
  let keyModules = [];
  if (fs.existsSync(srcDir)) {
    keyModules = (fs.readdirSync(srcDir).map(f => path.join(srcDir, f))
      .filter(p => fs.existsSync(p) && fs.statSync(p).isFile()))
      .slice(0, 20);
  }

  // Tests
  let tests = [];
  const testPatterns = ['**/tests/**/*.py', '**/tests/**/*.ts', '**/tests/**/*.tsx', '**/tests/**/*.js'];
  try {
    tests = fg.sync(testPatterns, { cwd: appPath, ignore: ['**/node_modules/**'], absolute: true, dot: true }).slice(0, 20);
  } catch (e) { /* ignore */ }

  const purpose = extractPurpose(appPath);

  return {
    app: appPath,
    purpose,
    architecture: {
      flow: [],
      key_modules: keyModules.map(p => ({ path: p })),
    },
    entrypoints,
    docs,
    tests_hot: tests,
    owners: [],
    expansion_handles: {
      entrypoints: `handle:entrypoints:${appPath}`,
      modules_index: `handle:modules:${appPath}`,
    },
    token_budget_hint: 1200,
    generated_at: new Date().toISOString(),
  };
}

function buildCapsules() {
  const apps = listAppRoots();
  for (const appPath of apps) {
    try {
      const capsule = summarizeApp(appPath);
      state.appCapsules.set(appPath, capsule);
      state.appsIndexed.add(appPath);
    } catch {}
  }
  state.lastIndexedAt = new Date();
}

function startWatchers() {
  const apps = listAppRoots();
  for (const appPath of apps) {
    chokidar.watch(appPath, { ignoreInitial: true, ignored: isIgnored }).on('all', (event, changedPath) => {
      if (!['add', 'change', 'unlink', 'addDir', 'unlinkDir'].includes(event)) return;
      // Debounce per app
      const existing = debounceTimers.get(appPath);
      if (existing) clearTimeout(existing);
      const t = setTimeout(() => {
        enqueueApp(appPath, 'watch');
        state.lastIndexedAt = new Date();
        pumpQueue();
      }, QUEUE_CONFIG.debounceMs);
      debounceTimers.set(appPath, t);
    });
  }
  // Schedule activity-based promotions on startup and periodically
  try { scheduleActivityPromotions(); } catch {}
  setInterval(() => { try { scheduleActivityPromotions(); pumpQueue(); } catch {} }, 5*60*1000);
}

// Tools
server.registerTool('workspace.list_roots', {
  description: 'List discovered app roots (discovered only, capsules may not be built yet)',
  inputSchema: {},
}, async () => {
  return { roots: listAppRoots() };
});

server.registerTool('workspace.list_apps', {
  description: 'List indexed applications in the workspace',
  inputSchema: {},
}, async () => {
  return { apps: Array.from(state.appCapsules.keys()) };
});

server.registerTool('workspace.find_app', {
  description: 'Fuzzy find an app by name or relative path',
  inputSchema: {
    name: z.string().min(1).describe('App hint (name or rel path)').optional(),
    limit: z.number().int().min(1).max(20).optional(),
  },
}, async ({ name, limit = 5 }) => {
  const candidates = listAppCandidates();
  const fuse = new Fuse(candidates, { keys: ['name','rel','path'], threshold: 0.4, ignoreLocation: true, includeScore: true });
  const results = name ? fuse.search(name, { limit }) : candidates.map(c => ({ item: c, score: 0 }));
  return { matches: results.map(r => ({ path: r.item.path, name: r.item.name, rel: r.item.rel, score: 1-(r.score??0) })) };
});

server.registerTool('workspace.bootstrap', {
  description: 'Build or refresh the capsule for an app',
  inputSchema: {
    app: z.string().min(1).describe('Absolute or workspace-relative app path'),
    intent: z.string().optional(),
    force: z.boolean().optional(),
  },
}, async ({ app, intent, force }) => {
  if (!app) throw new Error('app is required');
  const appPath = guardPathWithinWorkspace(path.isAbsolute(app) ? app : path.join(WORKSPACE_ROOT, app));
  let capsule = state.appCapsules.get(appPath);
  if (force || !capsule) {
    const cached = !force ? loadCapsule(appPath) : null;
    capsule = cached || summarizeApp(appPath);
    state.appCapsules.set(appPath, capsule);
    try { fs.writeFileSync(capsuleCachePath(appPath), JSON.stringify(capsule, null, 2), 'utf8'); } catch {}
  }
  return capsule;
});

server.registerTool('workspace.list_entrypoints', {
  description: 'List detected entrypoints for an app',
  inputSchema: {
    app: z.string().min(1).describe('Absolute or workspace-relative app path'),
  },
}, async ({ app }) => {
  if (!app) throw new Error('app is required');
  const appPath = guardPathWithinWorkspace(path.isAbsolute(app) ? app : path.join(WORKSPACE_ROOT, app));
  const capsule = state.appCapsules.get(appPath) || summarizeApp(appPath);
  return { app: appPath, entrypoints: capsule.entrypoints || [] };
});

server.registerTool('workspace.describe_symbol', {
  description: 'Return head and top-level defs for a file',
  inputSchema: {
    path: z.string().min(1).describe('File path (absolute or workspace-relative)'),
  },
}, async ({ path: targetPath }) => {
  if (!targetPath) throw new Error('path is required');
  const abs = guardPathWithinWorkspace(path.isAbsolute(targetPath) ? targetPath : path.join(WORKSPACE_ROOT, targetPath));
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) throw new Error('file not found');
  const text = isLargeFile(abs) ? readLargeFileSummary(abs) : fs.readFileSync(abs, 'utf8');
  const lines = text.split(/\r?\n/);
  const head = lines.slice(0, 60).join('\n');
  const defs = lines.filter(l => /(def |class |export |function )/.test(l)).slice(0, 60);
  return { path: abs, head, defs };
});

server.registerTool('workspace.tests_for', {
  description: 'List hot tests for an app',
  inputSchema: {
    app: z.string().min(1).describe('Absolute or workspace-relative app path').optional(),
  },
}, async ({ app }) => {
  const appPath = app ? guardPathWithinWorkspace(path.isAbsolute(app) ? app : path.join(WORKSPACE_ROOT, app)) : null;
  const capsule = appPath ? (state.appCapsules.get(appPath) || summarizeApp(appPath)) : { tests_hot: [] };
  return { app: appPath, tests: capsule.tests_hot || [] };
});

server.registerTool('workspace.owners', {
  description: 'Return ownership info (placeholder)',
  inputSchema: {
    path: z.string().optional(),
  },
}, async ({ path: targetPath }) => {
  return { path: targetPath || null, owners: [] };
});

// logs_recent tool removed (logs indexing disabled)

server.registerTool('workspace.search_semantic', {
  description: 'Hybrid search over code and docs for an app',
  inputSchema: {
    query: z.string().min(1).describe('Search query'),
    app: z.string().optional(),
    top_k: z.number().int().min(1).max(50).optional(),
    min_score: z.number().min(0).max(1).optional(),
    mode: z.enum(['hybrid','bm25','semantic']).optional(),
  },
}, async ({ query, app, top_k = 20, min_score = 0.75, mode = 'hybrid' }) => {
  if (!query) throw new Error('query is required');
  let targetApp = null;
  if (app) {
    targetApp = guardPathWithinWorkspace(path.isAbsolute(app) ? app : path.join(WORKSPACE_ROOT, app));
  } else {
    // Cross-app search: pick best app via fuzzy against query tokens
    const candidates = listAppCandidates();
    const fuse = new Fuse(candidates, { keys: ['name','rel'], threshold: 0.45, ignoreLocation: true });
    const guess = fuse.search(query, { limit: 1 })[0];
    targetApp = guess ? guess.item.path : Array.from(state.appCapsules.keys())[0];
  }
  if (!targetApp) throw new Error('no apps indexed');
  if (!state.appLunr.get(targetApp)) buildLunrForApp(targetApp);
  const { index, documents } = state.appLunr.get(targetApp);

  let bm = [];
  try { bm = index.search(lunr.tokenizer(query).toString()); } catch {}
  const bmDocs = bm.map(r => ({ path: r.ref, bm25: r.score, doc: documents.get(r.ref) })).filter(Boolean);

  let qVec = null;
  if (mode !== 'bm25') {
    qVec = await embed(query);
    for (const d of bmDocs.slice(0, 50)) {
      if (qVec) {
        const vec = await embed(d.doc.text.slice(0, 2000));
        d.semantic = vec ? cosineSim(qVec, vec) : 0;
      } else { d.semantic = 0; }
      d.score = (d.semantic||0)*0.7 + (d.bm25||0)*0.3;
    }
  } else {
    for (const d of bmDocs) d.score = d.bm25 || 0;
  }
  const ranked = bmDocs.sort((a,b)=> (b.score||0)-(a.score||0)).slice(0, top_k);

  const items = [];
  let hasEntry=false, hasTest=false, hasCore=false;
  for (const r of ranked) {
    const p = r.path;
    const text = isLargeFile(p) ? readLargeFileSummary(p) : r.doc.text;
    const lines = text.split(/\r?\n/);
    const preview = lines.slice(0,80).join('\n');
    items.push({ path:p, score:r.score||0, bm25:r.bm25||0, semantic:r.semantic||0, start_line:1, end_line:Math.min(80,lines.length), preview, reason:{ bm25:r.bm25, semantic:r.semantic } });
    hasEntry = hasEntry || /(\/src\/.*(main|cli|server|app|index)\.|package\.json$)/.test(p);
    hasTest = hasTest || /(^|\/)tests?\//.test(p) || /\.(spec|test)\./.test(p);
    hasCore = hasCore || /\/src\//.test(p);
  }
  if (!(hasEntry && hasTest && hasCore)) {
    const cap = state.appCapsules.get(targetApp) || summarizeApp(targetApp);
    const fillers = [];
    if (!hasEntry) for (const ep of (cap.entrypoints||[]).slice(0,3)) fillers.push(ep);
    if (!hasTest) for (const t of (cap.tests_hot||[]).slice(0,3)) fillers.push(t);
    const added = new Set(items.map(i=>i.path));
    for (const f of fillers) {
      if (f && !added.has(f) && fs.existsSync(f)) {
        const text = isLargeFile(f) ? readLargeFileSummary(f) : fs.readFileSync(f,'utf8');
        const preview = text.split(/\r?\n/).slice(0,80).join('\n');
        items.push({ path:f, score:0.6, bm25:0, semantic:0, start_line:1, end_line:80, preview, reason:{ coverage:true } });
        added.add(f);
      }
    }
  }
  const maxScore = items.reduce((m,i)=>Math.max(m, i.score||0), 0);
  if (maxScore < min_score) logTelemetry({ type:'low_confidence', query, app:targetApp, maxScore });
  return { app: targetApp, items, maxScore };
});

// Startup
(function main() {
  // Seed initial jobs for existing apps instead of eager building
  const apps = listAppRoots();
  for (const a of apps) enqueueApp(a, 'startup');
  startWatchers();
  const transport = new StdioServerTransport();
  server.connect(transport);
  // Pump queue periodically
  setInterval(pumpQueue, 500);
})();
