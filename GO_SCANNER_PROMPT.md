# Career-Ops Go Scanner Conversion

Use this prompt in a **fresh chat session** to convert the scanner components from Node.js to Go.

---

## Project Overview

Career-Ops is an open-source AI job search pipeline. Current stack: Node.js/ESM scripts + Next.js 14 web dashboard + Playwright. Data is stored in flat files (markdown, TSV, JSON).

**Goal:** Convert the scanner components (`scan.mjs`, `scan-ats-full.mjs`, `providers/`) to Go for performance (faster startup, goroutine-based concurrency, single binary). Keep everything else in Node.js.

---

## Current Architecture (What We're Replacing)

### Scanner (`scan.mjs` — 1259 lines)

The job portal scanner. Zero-LLM-token — pure HTTP + JSON. It:

1. **Loads providers** from `providers/*.mjs` — plugin-based, auto-discovered at startup
2. **Reads config** from `portals.yml` — tracked companies, title/location/salary/content filters
3. **Resolves providers** for each tracked company — URL-based auto-detection or explicit `provider:` field
4. **Fetches jobs** from ATS APIs — parallel fetch with 10 worker concurrency
5. **Applies filters** — title, location, salary, content, trust, cooldown, seniority tier
6. **Deduplicates** against `data/scan-history.tsv` and in-memory seen-set
7. **Outputs** to `data/pipeline.md`, `data/scan-history.tsv`, or `data/applications.md`

**Usage:**
```bash
node scan.mjs                              # scan all enabled companies
node scan.mjs --dry-run                    # preview without writing files
node scan.mjs --company Cohere             # scan a single company
node scan.mjs --verify                     # Playwright-check each new URL
```

### Reverse ATS Scanner (`scan-ats-full.mjs` — 547 lines)

Inverts the direction: walks public company directories per ATS (Greenhouse, Lever, Ashby, Workday) instead of scanning tracked companies. Uses cached company lists from a public dataset. Same provider modules.

### Provider Modules (`providers/*.mjs`)

Plugin-based. Each exports `{ id, detect(entry), fetch(entry, ctx) }`:

| File | Provider | API |
|------|----------|-----|
| `providers/greenhouse.mjs` | Greenhouse | `boards-api.greenhouse.io/v1/boards/{slug}/jobs` |
| `providers/lever.mjs` | Lever | `api.lever.co/v0/postings/{slug}?mode=json` |
| `providers/ashby.mjs` | Ashby | `api.ashbyhq.com/posting-api/job-board/{slug}` |
| `providers/workday.mjs` | Workday | `{host}/wday/cxs/{tenant}/jobpostings` |
| `providers/workable.mjs` | Workable | `workable.com/api/accounts/{slug}/jobs` |
| `providers/smartrecruiters.mjs` | SmartRecruiters | `api.smartrecruiters.com/v1/companies/{slug}/postings` |
| `providers/recruitee.mjs` | Recruitee | `api.recruitee.com/c/{slug}/jobs` |
| `providers/solidjobs.mjs` | SolidJobs | Custom scraper |

`_http.mjs` — shared HTTP transport: `fetchJson()`, `fetchText()` with timeout, abort, redirect control.

`_types.js` — JSDoc type definitions for PortalEntry, Provider, etc.

## What to Keep in Node.js (Don't Touch)

| Component | Reason |
|-----------|--------|
| `lib-ai/` | AI engine — LLM calls are the bottleneck anyway |
| `web/` (Next.js dashboard) | React/TypeScript ecosystem — keep as-is |
| `check-liveness.mjs` / `liveness-browser.mjs` | Playwright-based — Go doesn't have native Playwright |
| `generate-pdf.mjs` | Playwright HTML→PDF conversion |
| `generate-resumes*.mjs` | Resume builders |
| `ai.mjs` | CLI entry point for evaluations |
| `lib-outreach/` | Email discovery/verification — API-bound |
| `mcp-server/` | MCP protocol server |
| `providers/_http.mjs` | Only the HTTP transport — the providers themselves get rewritten in Go |

---

## Go Package Architecture

```
cmd/
  scanner/
    main.go              — Entry point: CLI flag parsing, orchestration
    scanner.go           — Core scan pipeline (fetch → filter → dedup → output)
    reverse.go           — Reverse ATS scanner (replaces scan-ats-full.mjs)

internal/
  config/
    portals.go           — Parse portals.yml into Go structs
    filters.go           — Title/location/salary/content filter builders
    filter_test.go       — Unit tests for all filter types

  provider/
    interface.go         — Provider interface { ID(), Detect(*PortalEntry) bool, Fetch(*PortalEntry, *Context) ([]Job, error) }
    context.go           — Shared HTTP context (fetchJSON, fetchText with timeout)
    registry.go          — Auto-discover and register providers
  
  providers/             — Each provider in its own file
    greenhouse.go
    lever.go
    ashby.go
    workday.go
    workable.go
    smartrecruiters.go
    recruitee.go
    solidjobs.go

  dedup/
    scanner.go           — Scan-history dedup logic
    companyrole.go       — Per-company-role dedup

  output/
    pipeline.go          — Append to data/pipeline.md
    scanhistory.go       — Append to data/scan-history.tsv
    applications.go      — Append to data/applications.md

  models/
    job.go               — Job struct (Title, URL, Company, Location, PostedAt, Description)
    entry.go             — PortalEntry struct (mirrors YAML structure)
    history.go           — Scan history policy/types

  filter/
    title.go             — Title filter (positive + negative keyword matching)
    location.go          — Location filter (always_allow/allow/block)
    salary.go            — Salary filter
    content.go           — Content filter (job description text)
    trust.go             — Trust validator
    cooldown.go          — Re-apply cooldown window
    tier.go              — Seniority tier classifier

pkg/
  scanner/
    scanner.go           — Public scanner API (importable from Node.js via subprocess)
```

## Data Structures (Go)

```go
// Job represents a single job posting from any provider
type Job struct {
    Title       string `json:"title"`
    URL         string `json:"url"`
    Company     string `json:"company"`
    Location    string `json:"location,omitempty"`
    PostedAt    int64  `json:"postedAt,omitempty"`  // epoch ms
    Description string `json:"description,omitempty"`
}

// PortalEntry mirrors a portals.yml tracked company entry
type PortalEntry struct {
    Name       string `yaml:"name"`
    Enabled    bool   `yaml:"enabled"`
    CareersURL string `yaml:"careers_url"`
    Provider   string `yaml:"provider"`
    API        string `yaml:"api"`
    ScanMethod string `yaml:"scan_method"`
    // ... plus any custom fields per provider
}

// Provider interface — same contract as JS providers
type Provider interface {
    ID() string
    Detect(entry *PortalEntry) bool
    Fetch(entry *PortalEntry, ctx *Context) ([]Job, error)
}

// Context shared across providers
type Context struct {
    client *http.Client
}

func (c *Context) FetchJSON(url string, opts ...RequestOption) ([]byte, error)
func (c *Context) FetchText(url string, opts ...RequestOption) (string, error)
```

## CLI Interface (`cmd/scanner/main.go`)

```bash
go-scanner scan [--company <name>] [--dry-run] [--concurrency 20]
go-scanner scan-ats [--since 3] [--ats greenhouse,workday] [--limit 200] [--dry-run]
go-scanner scan --help
```

### Flags (matching existing JS flags):

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--company` | string | "" | Scan single company (substring match on name) |
| `--dry-run` | bool | false | Preview without writing files |
| `--concurrency` | int | 20 | Worker goroutine count |
| `--config` | string | "portals.yml" | Path to portals.yml |
| `--data-dir` | string | "data" | Path to data directory |
| `--verbose` | bool | false | Log per-board fetch failures |
| `--since` | int | 3 | (scan-ats) Days to look back |
| `--ats` | string | "" | (scan-ats) Comma-separated ATS list |
| `--limit` | int | 0 | (scan-ats) Max companies per ATS |

---

## Key Design Decisions

### 1. Plugin-Based Providers via Registry Pattern (NOT Go plugins)

Use a simple registry pattern instead of Go's `plugin` package:

```go
// registry.go
var registry = map[string]Provider{}

func Register(p Provider) {
    registry[p.ID()] = p
}

func Get(id string) (Provider, bool) {
    p, ok := registry[id]
    return p, ok
}

func All() []Provider {
    result := make([]Provider, 0, len(registry))
    for _, p := range registry {
        result = append(result, p)
    }
    return result
}
```

Each provider registers itself in `init()`:

```go
// greenhouse.go
func init() { Register(&GreenhouseProvider{}) }

type GreenhouseProvider struct{}

func (p *GreenhouseProvider) ID() string { return "greenhouse" }
// ...
```

### 2. Concurrent Fetch with Goroutine Pool

Replace the Promise-based concurrency (10 workers) with a goroutine pool:

```go
func ParallelFetch(ctx context.Context, entries []*PortalEntry, concurrency int) []Result {
    results := make([]Result, 0, len(entries))
    var mu sync.Mutex
    sem := make(chan struct{}, concurrency)
    
    for _, entry := range entries {
        sem <- struct{}{}
        go func(e *PortalEntry) {
            defer func() { <-sem }()
            jobs, err := FetchProvider(e)
            mu.Lock()
            results = append(results, Result{Entry: e, Jobs: jobs, Err: err})
            mu.Unlock()
        }(entry)
    }
    // Wait for all goroutines
    for i := 0; i < concurrency; i++ {
        sem <- struct{}{}
    }
    return results
}
```

### 3. Flat File Backward Compatibility

The Go scanner MUST write the same flat-file format as the existing Node.js scanner so the rest of the system (web dashboard, Go TUI, Python scripts) still works:

- `data/scan-history.tsv` — tab-separated: `url\tfirst_seen\tportal\ttitle\tcompany\tstatus\tlocation`
- `data/pipeline.md` — markdown checklist: `- [ ] url | title @ company`
- `data/applications.md` — markdown table: `# | Date | Company | Role | Score | Status | PDF | Report | Notes`

### 4. Dedup Logic (Exact Match)

```go
// Load existing URLs from scan-history.tsv into a Set
type SeenSet struct {
    urls map[string]bool
}

func LoadSeenURLs(path string) (*SeenSet, error) {
    // Parse TSV, collect all URLs
}

func (s *SeenSet) Seen(url string) bool {
    return s.urls[url]
}

func (s *SeenSet) Add(url string) {
    s.urls[url] = true
}
```

### 5. YAML Config

Use `gopkg.in/yaml.v3` to parse `portals.yml` into Go structs. The config file has sections:
- `tracked_companies` — list of { name, enabled, careers_url, api, ... }
- `job_boards` — list of { name, enabled, url, ... }
- `title_filter` — { positive: [...], negative: [...] }
- `location_filter` — { always_allow: [...], allow: [...], block: [...] }
- `salary_filter` — { currency: "...", ... }
- `content_filter` — { positive: [...], negative: [...] }
- `trust_filter` — { ... }
- `scan_history` — { policy: "..." }
- `skip_tiers` — [...]

### 6. CLI via `flag` Package

Use Go standard library `flag` package. For `scan` vs `scan-ats` subcommands, use `os.Args[1]` dispatch or the `subcmd` pattern.

---

## Provider Implementation: Greenhouse Example

```go
// providers/greenhouse.go
package providers

import (
    "fmt"
    "net/url"
    "strings"
    "time"
    
    "github.com/yourorg/go-scanner/internal/provider"
)

func init() { provider.Register(&Greenhouse{}) }

type Greenhouse struct{}

var allowedHosts = map[string]bool{
    "boards-api.greenhouse.io":       true,
    "boards.greenhouse.io":           true,
    "job-boards.greenhouse.io":       true,
    "job-boards.eu.greenhouse.io":    true,
}

func (g *Greenhouse) ID() string { return "greenhouse" }

func (g *Greenhouse) Detect(entry *provider.PortalEntry) bool {
    // Check if careers_url matches greenhouse pattern
    if entry.API != "" {
        return isGreenhouseURL(entry.API)
    }
    match := greenhouseRE.FindStringSubmatch(entry.CareersURL)
    return match != nil
}

func (g *Greenhouse) Fetch(entry *provider.PortalEntry, ctx *provider.Context) ([]provider.Job, error) {
    apiURL := resolveAPIURL(entry)
    if apiURL == "" {
        return nil, fmt.Errorf("greenhouse: cannot derive API URL for %s", entry.Name)
    }
    
    body, err := ctx.FetchJSON(apiURL)
    if err != nil {
        return nil, err
    }
    
    // Parse JSON response
    var resp struct {
        Jobs []struct {
            Title          string `json:"title"`
            AbsoluteURL    string `json:"absolute_url"`
            Location       *struct { Name string `json:"name"` } `json:"location"`
            FirstPublished string `json:"first_published"`
        } `json:"jobs"`
    }
    if err := json.Unmarshal(body, &resp); err != nil {
        return nil, err
    }
    
    var jobs []provider.Job
    for _, j := range resp.Jobs {
        if j.AbsoluteURL == "" { continue }
        job := provider.Job{
            Title:   j.Title,
            URL:     j.AbsoluteURL,
            Company: entry.Name,
        }
        if j.Location != nil {
            job.Location = j.Location.Name
        }
        if t, err := time.Parse(time.RFC3339, j.FirstPublished); err == nil {
            job.PostedAt = t.UnixMilli()
        }
        jobs = append(jobs, job)
    }
    return jobs, nil
}
```

---

## Files to Create

### `cmd/scanner/main.go`

Entry point. Parse flags, dispatch to `scan` or `scan-ats` subcommand:

```go
func main() {
    flag.Usage = func() { /* print help */ }
    
    switch os.Args[1] {
    case "scan":
        scanCmd := flag.NewFlagSet("scan", flag.ExitOnError)
        // ... flags
        scanCmd.Parse(os.Args[2:])
        runScan(opts)
    case "scan-ats":
        // ...
    }
}
```

### `cmd/scanner/scanner.go`

Core scan pipeline:
1. Load providers (registry)
2. Parse portals.yml
3. Build filters (title, location, salary, content, trust)
4. Resolve providers for each enabled company
5. Load dedup sets from scan-history.tsv
6. ParallelFetch from all targets
7. Apply filters → dedup → collect offers
8. Load cooldown windows → filter
9. Write to pipeline.md + scan-history.tsv

### `cmd/scanner/reverse.go`

Reverse ATS scan (replaces `scan-ats-full.mjs`):
1. Download/cache company lists from job-board-aggregator dataset
2. For each ATS (greenhouse, lever, ashby, workday), iterate companies
3. Fetch jobs from each company's board
4. Apply same filters as scan
5. Dedup against seen URLs
6. Write to pipeline + scan-history

### `internal/provider/interface.go`

```go
package provider

type Provider interface {
    ID() string
    Detect(entry *PortalEntry) bool
    Fetch(entry *PortalEntry, ctx *Context) ([]Job, error)
}

type PortalEntry struct {
    Name       string
    Enabled    bool
    CareersURL string `yaml:"careers_url"`
    Provider   string
    API        string
    // Extensible: store unknown fields in a map
    Extra      map[string]any
}

func (e *PortalEntry) Get(key string) (any, bool)
```

### `internal/provider/context.go`

```go
type Context struct {
    client  *http.Client
    verbose bool
}

func NewContext(timeout time.Duration) *Context

func (c *Context) FetchJSON(url string) ([]byte, error)
func (c *Context) FetchText(url string) (string, error)
```

### `internal/provider/registry.go`

```go
var registry = make(map[string]Provider)

func Register(p Provider)
func Get(id string) (Provider, bool)
func All() []Provider
func Detect(entry *PortalEntry) (Provider, bool)
```

### `internal/config/portals.go`

Parse portals.yml into typed structs:

```go
type Config struct {
    TrackedCompanies []PortalEntry `yaml:"tracked_companies"`
    JobBoards        []PortalEntry `yaml:"job_boards"`
    TitleFilter      *TitleFilter  `yaml:"title_filter"`
    LocationFilter   *LocationFilter `yaml:"location_filter"`
    // ...
}

func LoadPortals(path string) (*Config, error)
```

### `internal/config/filters.go`

Filter builder functions:

```go
type TitleFilter struct {
    positive []*regexp.Regexp
    negative []*regexp.Regexp
}

func (f *TitleFilter) Match(title string) bool {
    lower := strings.ToLower(title)
    hasPos := len(f.positive) == 0
    for _, re := range f.positive {
        if re.MatchString(lower) { hasPos = true; break }
    }
    for _, re := range f.negative {
        if re.MatchString(lower) { return false }
    }
    return hasPos
}

func BuildTitleFilter(cfg *TitleFilterConfig) *TitleFilter
```

### `internal/dedup/scanner.go`

TSV-based URL dedup:

```go
type ScanHistory struct {
    urls map[string]bool
}

func LoadScanHistory(path string) (*ScanHistory, error)
func (s *ScanHistory) Seen(url string) bool
func (s *ScanHistory) Add(url string)
```

### `internal/output/pipeline.go`

Markdown output writer (matches exact existing format):

```go
func AppendToPipeline(path string, jobs []Job, dryRun bool) error
```

Format:
```
- [ ] https://boards.greenhouse.io/... | Software Engineer @ Company Inc
```

### `internal/output/scanhistory.go`

TSV output writer (matches exact existing format):

```go
func AppendToScanHistory(path string, jobs []Job, portal string) error
```

Format:
```
url\t2026-07-03\tgreenhouse\tSoftware Engineer\tCompany Inc\tnew\tRemote
```

### `go.mod`

```
module github.com/santifer/career-ops/scanner

go 1.24

require (
    gopkg.in/yaml.v3 v3.0.1
)
```

Keep dependencies minimal — no external HTTP client needed (stdlib `net/http` is sufficient).

---

## Performance Targets

| Metric | Node.js (current) | Go (target) |
|--------|-------------------|-------------|
| Startup time | ~200ms | **<10ms** |
| 50-company scan | ~8s (10 concurrent) | **~3s** (20 goroutines) |
| Full ATS discovery (500+ boards) | ~45s (20 concurrent) | **~15s** (50 goroutines) |
| Binary size | ~50MB (node + deps) | **~15MB** (static binary) |
| Memory per scan | ~80MB | **~20MB** |

---

## Subprocess Integration with Node.js

The Go scanner binary will be called from the Node.js CLI and web dashboard as a subprocess:

**From Node.js CLI:**
```javascript
// In scan.mjs (modified to delegate to Go when available)
import { execSync } from 'child_process';

function scanWithGo(opts) {
    const args = ['scan'];
    if (opts.company) args.push('--company', opts.company);
    if (opts.dryRun) args.push('--dry-run');
    args.push('--data-dir', 'data');
    
    const result = execSync(`./bin/go-scanner ${args.join(' ')}`, {
        encoding: 'utf-8',
        maxBuffer: 50 * 1024 * 1024,
    });
    return result;
}
```

**From web dashboard API:**
```typescript
// web/app/api/scan/route.ts
const { execSync } = require('child_process');

export async function POST(req: Request) {
    const result = execSync('./bin/go-scanner scan --data-dir data', {
        cwd: projectRoot(),
        encoding: 'utf-8',
    });
    return Response.json({ output: result });
}
```

**Graceful fallback:** The existing Node.js `scan.mjs` stays as a fallback. If the Go binary doesn't exist, fall back to `node scan.mjs`.

---

## Integration with Existing Go TUI Dashboard

The `dashboard/main.go` already reads `data/applications.md` and `data/scan-history.tsv` via `internal/data/career.go`. The Go scanner writes the same file formats, so the Go TUI dashboard continues to work without changes.

---

## Implementation Order

1. **Set up Go module** (`go.mod`, directory structure)
2. **Implement `providers/`** — all 8 providers (greenhouse, lever, ashby, workday, workable, smartrecruiters, recruitee, solidjobs) + HTTP context + registry
3. **Implement `config/`** — portals.yml parsing + filter builders
4. **Implement `dedup/`** — scan-history TSV reader + dedup set
5. **Implement `output/`** — pipeline.md + scan-history.tsv writers
6. **Implement `models/`** — Job, PortalEntry, etc.
7. **Implement `cmd/scanner/scanner.go`** — core scan pipeline
8. **Implement `cmd/scanner/reverse.go`** — reverse ATS scan
9. **Implement `cmd/scanner/main.go`** — CLI entry point with flag parsing
10. **Write tests** — unit tests for each provider, filter, dedup
11. **Build** — `go build -o bin/go-scanner ./cmd/scanner`
12. **Integration** — update web dashboard API routes and CLI to call Go binary
13. **Benchmark** — compare startup time, scan speed, memory usage

## Testing

```bash
go test ./internal/provider/... -v
go test ./internal/config/... -v
go test ./internal/dedup/... -v
go test ./internal/filter/... -v

# End-to-end test with actual portals.yml
go run ./cmd/scanner scan --company Cohere --dry-run --verbose

# Full test
go run ./cmd/scanner scan --dry-run
```

---

## Key Design Principles

1. **Backward compatibility**: Writes the exact same file formats. Other tools (web dashboard, Go TUI, Python scripts) must not break.
2. **Graceful fallback**: Node.js scan.mjs stays as fallback when Go binary is absent.
3. **Minimal dependencies**: stdlib `net/http`, `gopkg.in/yaml.v3`, nothing else.
4. **Provider plugin pattern**: Same provider interface as JS — easy to add new providers via `init()` registration.
5. **Exact match dedup**: Same logic as JS — URL-based seen-set from scan-history.tsv.
6. **Same filter semantics**: Title/location/salary/content filters match JS behavior exactly.
