# 🧠 Workspace MCP Server

<div align="center">

**🚀 Intelligent workspace analysis powered by AI • Zero-config setup • Lightning-fast semantic search**

[![Node.js](https://img.shields.io/badge/Node.js-18+-brightgreen.svg?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![MCP Protocol](https://img.shields.io/badge/MCP%20Protocol-2024--11--05-blue.svg?style=for-the-badge)](https://github.com/modelcontextprotocol/typescript-sdk)
[![AI Powered](https://img.shields.io/badge/AI%20Powered-Gemini%20%7C%20OpenAI-orange.svg?style=for-the-badge&logo=google)](https://ai.google.dev/)
[![License](https://img.shields.io/badge/License-ISC-yellow.svg?style=for-the-badge)](LICENSE)

</div>

---

## ✨ What Makes This Special

🧠 **AI-Powered Intelligence** • Automatically understands your codebase structure and purpose  
⚡ **Zero Configuration** • Smart workspace detection with one command setup  
🔍 **Hybrid Search** • Combines keyword + semantic search for precise results  
🏗️ **Intelligent Caching** • Builds lightweight "capsules" for lightning-fast queries  
🎯 **Activity-Aware** • Prioritizes your most-used projects automatically  
🔒 **Privacy-First** • Local processing with optional AI enhancement

## 🚀 Quick Start

<div align="center">

**Three commands to transform your development workflow:**

</div>

```bash
# 1️⃣ Clone and install
git clone https://github.com/YOUR_USERNAME/workspace-mcp.git
cd workspace-mcp && npm install

# 2️⃣ Smart auto-configuration (detects your workspace structure)
npx workspace-mcp init

# 3️⃣ Start the intelligent MCP server
npx workspace-mcp start
```

<details>
<summary>🔧 <strong>Advanced Options</strong></summary>

```bash
# Preview configuration without writing
npx workspace-mcp analyze --dry-run

# Development mode with auto-reload
npm run dev

# Test AI integration
node test_ai.js

# Override workspace root
WORKSPACE_MCP_ROOT=/custom/path npx workspace-mcp init
```

</details>

## 📖 Overview

Transform your development workflow with **intelligent workspace understanding**. This MCP server automatically discovers, analyzes, and indexes your projects using AI-powered summarization, creating a semantic search engine that understands your code's purpose and structure.

### 🎯 The Problem It Solves

Traditional code search is limited to exact text matching. When you ask "Where is user authentication handled?" or "How does the payment flow work?", you end up manually searching through dozens of files. 

**Workspace MCP changes that.** It understands your codebase semantically, so you can ask conceptual questions and get precise answers instantly.

### 🧠 How It Works

```mermaid
%%{init: {"theme": "base", "themeVariables": {"primaryColor": "#ffffff", "primaryTextColor": "#000000", "primaryBorderColor": "#000000", "lineColor": "#000000", "background": "#ffffff"}} }%%
graph LR
    A[📁 Your Workspace] --> B[🔍 AI Analysis]
    B --> C[📦 Smart Capsules]
    C --> D[⚡ Instant Search]
    
    style A fill:#e3f2fd,color:#000,stroke:#000
    style B fill:#fff3e0,color:#000,stroke:#000
    style C fill:#f3e5f5,color:#000,stroke:#000
    style D fill:#e8f5e8,color:#000,stroke:#000
```

1. **🔍 Discovers** your projects automatically using smart glob patterns
2. **🧠 Analyzes** each app with AI to understand its purpose and structure  
3. **📦 Creates** lightweight "capsules" with metadata, docs, tests, and entrypoints
4. **⚡ Serves** lightning-fast semantic search through MCP protocol

## 🌟 Key Features

<table>
<tr>
<td width="50%">

### 🧠 **AI-Powered Analysis**
- **Smart Purpose Detection** using Gemini/OpenAI
- **Automatic Code Understanding** 
- **Intelligent Project Classification**
- **Context-Aware Summarization**

### ⚡ **Lightning Performance**
- **Intelligent Caching System**
- **Hybrid Search (BM25 + Semantic)**
- **Activity-Based Prioritization**
- **Real-time File Watching**

</td>
<td width="50%">

### 🎯 **Zero-Config Setup**
- **Auto-Workspace Detection**
- **Smart Glob Pattern Suggestions**
- **Git-Aware Processing**
- **One-Command Installation**

### 🔒 **Privacy & Security**
- **Local-First Processing**
- **Workspace Boundary Protection**
- **Optional AI Enhancement**
- **No Data Lock-in**

</td>
</tr>
</table>

## 🏗️ Architecture

### System Overview

```mermaid
%%{init: {"theme": "base", "themeVariables": {"primaryColor": "#ffffff", "primaryTextColor": "#000000", "primaryBorderColor": "#000000", "lineColor": "#000000", "secondaryColor": "#f0f0f0", "tertiaryColor": "#ffffff", "background": "#ffffff", "mainBkg": "#ffffff", "secondaryTextColor": "#000000", "tertiaryTextColor": "#000000", "fontSize": "14px"}} }%%
graph TB
    subgraph "Workspace MCP Server"
        direction TB
        
        subgraph "Core Components"
            WS[Workspace Scanner]
            CG[Capsule Generator]
            QM[Queue Manager]
            FS[File Watcher]
        end
        
        subgraph "Storage Layer"
            CM[Capsule Memory]
            CC[Capsule Cache]
            SI[Search Index]
        end
        
        subgraph "Search Engine"
            BM[BM25 Index]
            SE[Semantic Embeddings]
            HS[Hybrid Search]
        end
        
        subgraph "MCP Interface"
            TR[Tool Registry]
            RH[Request Handler]
            ST[StdIO Transport]
        end
    end
    
    subgraph "External Systems"
        CLIENT[MCP Client/Cursor]
        WORKSPACE[File System]
        CONFIG[config.json]
    end
    
    WS --> WORKSPACE
    CG --> CM
    CG --> CC
    QM --> CG
    FS --> QM
    CM --> SI
    SI --> BM
    SI --> SE
    BM --> HS
    SE --> HS
    HS --> TR
    TR --> RH
    RH --> ST
    ST <--> CLIENT
    CONFIG --> WS
    
    style WS fill:#e1f5fe,color:#000000,stroke:#000000
    style CG fill:#f3e5f5,color:#000000,stroke:#000000
    style QM fill:#fff3e0,color:#000000,stroke:#000000
    style HS fill:#e8f5e8,color:#000000,stroke:#000000
```

### Data Flow

```mermaid
%%{init: {"theme": "base", "themeVariables": {"primaryColor": "#ffffff", "primaryTextColor": "#000000", "primaryBorderColor": "#000000", "lineColor": "#000000", "secondaryColor": "#f0f0f0", "tertiaryColor": "#ffffff", "background": "#ffffff", "mainBkg": "#ffffff", "secondaryTextColor": "#000000", "tertiaryTextColor": "#000000", "fontSize": "14px"}} }%%
sequenceDiagram
    participant Client as MCP Client
    participant Server as Workspace MCP
    participant Scanner as App Scanner
    participant Queue as Job Queue
    participant Generator as Capsule Generator
    participant Cache as File Cache
    participant Search as Search Engine

    Client->>Server: Initialize MCP Connection
    Server->>Scanner: Discover Apps
    Scanner->>Queue: Enqueue Apps for Processing
    
    loop Queue Processing
        Queue->>Generator: Process App
        Generator->>Cache: Read/Write Capsule
        Generator->>Search: Build Search Index
    end
    
    Client->>Server: search_semantic(query)
    Server->>Search: Hybrid Search
    Search-->>Server: Ranked Results
    Server-->>Client: Search Results
    
    Note over Server, Cache: File watching triggers re-indexing
```

### Capsule Structure

```mermaid
%%{init: {"theme": "base", "themeVariables": {"primaryColor": "#ffffff", "primaryTextColor": "#000000", "primaryBorderColor": "#000000", "lineColor": "#000000", "secondaryColor": "#f0f0f0", "tertiaryColor": "#ffffff", "background": "#ffffff", "mainBkg": "#ffffff", "secondaryTextColor": "#000000", "tertiaryTextColor": "#000000", "fontSize": "14px"}} }%%
graph LR
    subgraph "App Capsule"
        direction TB
        
        META[Metadata<br/>• Purpose<br/>• Generated At<br/>• Token Budget]
        
        ARCH[Architecture<br/>• Key Modules<br/>• Flow Diagram<br/>• Dependencies]
        
        ENTRY[Entrypoints<br/>• Main Files<br/>• CLI Scripts<br/>• Server Files]
        
        DOCS[Documentation<br/>• README<br/>• Architecture<br/>• Runbooks]
        
        TESTS[Test Suite<br/>• Unit Tests<br/>• Integration<br/>• Hot Tests]
        
        OWNERS[Ownership<br/>• Team Info<br/>• Maintainers<br/>• Contacts]
        
        AI[AI Analysis<br/>• Role Classification<br/>• Confidence Score<br/>• Evidence Paths]
    end
    
    META --> ARCH
    ARCH --> ENTRY
    ENTRY --> DOCS
    DOCS --> TESTS
    TESTS --> OWNERS
    OWNERS --> AI
    
    style META fill:#e3f2fd,color:#111111
    style ARCH fill:#f1f8e9,color:#111111
    style ENTRY fill:#fff3e0,color:#111111
    style DOCS fill:#fce4ec,color:#111111
    style TESTS fill:#e8f5e8,color:#111111
    style OWNERS fill:#f3e5f5,color:#111111
    style AI fill:#fff8e1,color:#111111
```

## ⚙️ Configuration

### config.json Structure

```json
{
  "workspaceRoot": "/path/to/your/workspace",
  "appGlobs": [
    "apps/*",
    "packages/*",
    "services/*",
    "tools/*",
    "documentation/*",
    "notes/*"
  ],
  "ignore": [
    "**/node_modules/**",
    "**/.git/**",
    "**/.venv/**",
    "**/dist/**",
    "**/*.png",
    "**/*.log"
  ],
  "queue": {
    "maxConcurrentSummaries": 3,
    "summariesPerMinute": 3,
    "debounceMs": 750,
    "priorityPaths": ["/path/to/your/workspace/priority/apps"]
  },
  "purpose": {
    "limits": {
      "maxFiles": 25,
      "maxBytes": 350000,
      "chunkTokens": 3000,
      "timeoutMs": 8000
    },
    "gitRepoOverrides": {
      "maxFiles": 50,
      "maxBytes": 800000,
      "chunkTokens": 3800,
      "timeoutMs": 12000
    }
  },
  "activity": {
    "enable": true,
    "sources": {
      "cursorIde": true,
      "cursorSessions": true,
      "fsMtime": true
    },
    "promote": {
      "minScore": 3.0,
      "maxPerRoot": 20,
      "depthLimit": 2
    }
  }
}
```

### Configuration Options

| Section | Option | Description | Default |
|---------|--------|-------------|---------|
| `workspaceRoot` | - | Root directory to scan | `/path/to/your/workspace` |
| `appGlobs` | - | Patterns to find applications | `["apps/*", "packages/*"]` |
| `ignore` | - | Patterns to ignore during scanning | Common build/cache dirs |
| `queue.maxConcurrentSummaries` | - | Max parallel processing jobs | `3` |
| `queue.summariesPerMinute` | - | Rate limit for AI summarization | `3` |
| `queue.debounceMs` | - | Debounce window for file changes | `750` |
| `purpose.limits.maxFiles` | - | Max files to analyze per app | `25` |
| `purpose.limits.maxBytes` | - | Max bytes to process per app | `350000` |
| `activity.enable` | - | Enable activity-based promotion | `true` |
| `activity.promote.minScore` | - | Min score for promotion | `3.0` |

### AI Summarization (default: Gemini → OpenAI → local)

- Enabled by default. To disable:
```bash
export WORKSPACE_MCP_AI=disabled
# or
export WORKSPACE_MCP_AI_DISABLE=1
```
- To use Gemini CLI (default priority):
```bash
export WORKSPACE_MCP_GEMINI_CLI=gemini
export WORKSPACE_MCP_GEMINI_MODEL=gemini-1.5-flash
export GOOGLE_API_KEY=your-gemini-api-key
# Optional custom args template (tokens: {MODEL}, {PROMPT})
# export WORKSPACE_MCP_GEMINI_ARGS="-m {MODEL} generate -p {PROMPT}"
```
- OpenAI fallback:
```bash
export OPENAI_API_KEY=sk-...
export WORKSPACE_MCP_AI_MODEL=gpt-4o-mini
```
- Custom endpoint (lowest priority):
```bash
export WORKSPACE_MCP_AI_ENDPOINT=https://your-ai-endpoint/summarize
export WORKSPACE_MCP_AI_AUTH="Bearer <TOKEN>"   # optional
```

## 🛠️ Available Tools

The server exposes the following MCP tools:

### Core Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `workspace.list_roots` | List discovered app root directories | None |
| `workspace.list_apps` | List indexed applications | None |
| `workspace.find_app` | Fuzzy search for apps by name | `name`, `limit` |
| `workspace.bootstrap` | Build/refresh capsule for an app | `app`, `force`, `intent` |

### Analysis Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `workspace.list_entrypoints` | Get detected entrypoints for an app | `app` |
| `workspace.describe_symbol` | Get file head and top-level definitions | `path` |
| `workspace.tests_for` | List hot tests for an app | `app` |
| `workspace.owners` | Get ownership information | `path` |

### Search Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `workspace.search_semantic` | Hybrid semantic + BM25 search | `query`, `app`, `top_k`, `min_score`, `mode` |

### Search Modes

- **`hybrid`** (default): Combines BM25 and semantic similarity (70% semantic + 30% BM25)
- **`bm25`**: Pure keyword-based search using BM25 algorithm
- **`semantic`**: Pure semantic similarity using embeddings

## 🔄 Queue Management

### Processing Pipeline

```mermaid
%%{init: {"theme": "base", "themeVariables": {"primaryColor": "#ffffff", "primaryTextColor": "#000000", "primaryBorderColor": "#000000", "lineColor": "#000000", "secondaryColor": "#f0f0f0", "tertiaryColor": "#ffffff", "background": "#ffffff", "mainBkg": "#ffffff", "secondaryTextColor": "#000000", "tertiaryTextColor": "#000000", "fontSize": "14px"}} }%%
graph LR
    subgraph "Job Queue System"
        direction LR
        
        TRIGGER[File Changes<br/>Activity<br/>Startup]
        
        DEBOUNCE[Debounce<br/>750ms window]
        
        QUEUE[Priority Queue<br/>• Priority 1: Priority paths<br/>• Priority 2: Standard<br/>• FIFO within priority]
        
        RATE[Rate Limiter<br/>• 3 jobs/minute<br/>• 3 concurrent max]
        
        PROCESS[Processing<br/>• Git detection<br/>• Metadata creation<br/>• AI summarization<br/>• Capsule caching]
        
        TRIGGER --> DEBOUNCE
        DEBOUNCE --> QUEUE
        QUEUE --> RATE
        RATE --> PROCESS
    end
    
    style TRIGGER fill:#ffecb3,color:#111111
    style DEBOUNCE fill:#e1f5fe,color:#111111
    style QUEUE fill:#f3e5f5,color:#111111
    style RATE fill:#fff3e0,color:#111111
    style PROCESS fill:#e8f5e8,color:#111111
```

### Activity-based Promotion

The system tracks activity from multiple sources to promote frequently used applications:

1. **Cursor IDE State** - Currently open files and workspaces
2. **Cursor Sessions** - Historical session data
3. **File System Activity** - Recently modified files (7-day window)

Applications with activity scores above the threshold (`minScore: 3.0`) are automatically promoted for processing.

## 📁 Cache Structure

Capsules are cached in the `cache/` directory with hex-encoded filenames:

```
cache/
├── capsule_2f70617468746f...796f7572617070732d7465737467656e657261746f72.json
├── capsule_2f70617468746f...796f75726170707372657073677263756a.json
└── telemetry.log
```

Each capsule contains:
- Application metadata and purpose
- Architecture overview with key modules
- Detected entrypoints and documentation
- Test suite information
- AI analysis results

## 🧪 Testing

### CLI Quick Checks

Use the CLI to exercise tools through the MCP server:

```bash
# List tools from your MCP client or connect and call via your environment
# (Client wiring varies; see Cursor MCP settings to add the binary: node /ABS/PATH/tools/workspace-mcp/index.js)
```

### Debug Bootstrap

For debugging capsule generation:

```bash
node debug-bootstrap.js [app-path]
```

## 🔍 Search Examples

### Basic Search
```javascript
// Find authentication-related code
{
  "method": "tools/call",
  "params": {
    "name": "workspace.search_semantic",
    "arguments": {
      "query": "user authentication login",
      "mode": "hybrid",
      "top_k": 10
    }
  }
}
```

### App-specific Search
```javascript
// Search within a specific application
{
  "method": "tools/call",
  "params": {
    "name": "workspace.search_semantic",
    "arguments": {
      "query": "MCP protocol implementation",
      "app": "/path/to/your/workspace/apps/your-app",
      "mode": "semantic",
      "top_k": 5
    }
  }
}
```

## 📊 Performance Characteristics

### Indexing Performance

- **Cold Start**: ~2-3 seconds for 50 applications
- **Incremental Updates**: ~100-500ms per application
- **Memory Usage**: ~50-100MB for typical workspace
- **Cache Hit Rate**: >90% for stable codebases

### Search Performance

- **Hybrid Search**: ~100-300ms per query
- **BM25 Only**: ~50-100ms per query
- **Semantic Only**: ~200-500ms per query (includes embedding)

## 🛡️ Security & Privacy

- **Workspace Boundaries**: All operations are restricted to configured workspace root
- **No External Calls**: AI summarization is currently stubbed (no external API calls)
- **Local Processing**: All indexing and search happens locally
- **File Access**: Read-only access to workspace files

## 🔧 Development

### Project Structure

```
workspace-mcp/
├── index.js              # Main MCP server implementation
├── cli.js                # npx-style CLI (init/start/analyze --dry-run)
├── config.json           # Workspace configuration (user-specific)
├── package.json          # Node.js dependencies and bin entry
├── debug-bootstrap.js    # Optional: capsule generator for a single app
├── cache/               # Capsule cache directory
│   ├── capsule_*.json   # Individual app capsules
│   └── telemetry.log    # Usage telemetry
└── README.md           # This file
```

### Key Dependencies

- **[@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk)**: MCP protocol implementation
- **[@xenova/transformers](https://github.com/xenova/transformers.js)**: Local ML embeddings
- **[chokidar](https://github.com/paulmillr/chokidar)**: File system watching
- **[fast-glob](https://github.com/mrmlnc/fast-glob)**: High-performance file globbing
- **[fuse.js](https://fusejs.io/)**: Fuzzy search for app discovery
- **[lunr](https://lunrjs.com/)**: Full-text search indexing

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with `node test_harness.cjs`
5. Submit a pull request

## 📈 Roadmap

- [ ] **Enhanced AI Summarization** - Integration with external LLM APIs
- [ ] **Real-time Collaboration** - Multi-user workspace support  
- [ ] **Advanced Analytics** - Usage patterns and code quality metrics
- [ ] **Plugin System** - Custom analyzers and extractors
- [ ] **Web Interface** - Browser-based workspace exploration
- [ ] **Integration APIs** - Webhooks and external system connectors

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🚀 Ready to Share?

This project is ready for GitHub! Here's how to publish:

```bash
# Create GitHub repository
gh repo create workspace-mcp --public --source=. --push

# Or manually:
# 1. Create repo at https://github.com/new
# 2. Then:
git remote add origin https://github.com/YOUR_USERNAME/workspace-mcp.git
git push -u origin main
```

## 🤝 Support & Community

<div align="center">

[![GitHub Issues](https://img.shields.io/badge/Issues-Welcome-brightgreen.svg?style=for-the-badge&logo=github)](../../issues)
[![Discussions](https://img.shields.io/badge/Discussions-Join%20Us-blue.svg?style=for-the-badge&logo=github)](../../discussions)
[![Contributing](https://img.shields.io/badge/Contributing-Guide-purple.svg?style=for-the-badge)](CONTRIBUTING.md)

</div>

### 📚 Documentation

- **[WORKFLOW_AND_TOOLS.md](WORKFLOW_AND_TOOLS.md)** - Deep dive into architecture and tooling
- **[config.example.json](config.example.json)** - Configuration reference
- **[test_ai.js](test_ai.js)** - AI integration testing

---

<div align="center">

**🧠 Built with AI • ⚡ Powered by Intelligence • 🚀 Made for Developers**

*Transform your development workflow with intelligent workspace understanding*

[![Star this repo](https://img.shields.io/badge/⭐-Star%20this%20repo-yellow.svg?style=for-the-badge)](../../stargazers)

</div>
