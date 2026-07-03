package main

import (
	"flag"
	"fmt"
	"os"
	"strings"
)

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	switch os.Args[1] {
	case "scan":
		runScanCmd()
	case "scan-ats":
		runScanATSCmd()
	case "help", "--help", "-h":
		printUsage()
	default:
		fmt.Fprintf(os.Stderr, "unknown subcommand: %s\n\n", os.Args[1])
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println(`go-scanner — Job portal scanner (Go)

Usage:
  go-scanner scan [flags]         Scan tracked companies
  go-scanner scan-ats [flags]     Reverse ATS scan
  go-scanner help                 Print this help

Scan flags:
  --company <name>       Scan single company (substring match)
  --dry-run              Preview without writing files
  --concurrency <n>      Worker goroutine count (default: 20)
  --config <path>        Path to portals.yml (default: portals.yml)
  --data-dir <path>      Path to data directory (default: data)
  --verbose              Log per-board fetch failures

Scan-ATS flags:
  --since <days>         Days to look back (default: 3)
  --ats <list>           Comma-separated ATS list (greenhouse,lever,ashby,workday)
  --limit <n>            Max companies per ATS (default: 0 = unlimited)
  --dry-run              Preview without writing files
  --concurrency <n>      Worker goroutine count (default: 50)
  --data-dir <path>      Path to data directory (default: data)
  --verbose              Log per-board fetch failures
`)
}

type scanOpts struct {
	company     string
	dryRun      bool
	concurrency int
	configPath  string
	dataDir     string
	verbose     bool
}

type scanATSOpts struct {
	since       int
	ats         []string
	limit       int
	dryRun      bool
	concurrency int
	dataDir     string
	verbose     bool
}

func runScanCmd() {
	fs := flag.NewFlagSet("scan", flag.ExitOnError)
	opts := &scanOpts{}
	fs.StringVar(&opts.company, "company", "", "Scan single company (substring match)")
	fs.BoolVar(&opts.dryRun, "dry-run", false, "Preview without writing files")
	fs.IntVar(&opts.concurrency, "concurrency", 20, "Worker goroutine count")
	fs.StringVar(&opts.configPath, "config", "portals.yml", "Path to portals.yml")
	fs.StringVar(&opts.dataDir, "data-dir", "data", "Path to data directory")
	fs.BoolVar(&opts.verbose, "verbose", false, "Log per-board fetch failures")
	fs.Parse(os.Args[2:])

	if err := runScan(opts); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

func runScanATSCmd() {
	fs := flag.NewFlagSet("scan-ats", flag.ExitOnError)
	opts := &scanATSOpts{}
	fs.IntVar(&opts.since, "since", 3, "Days to look back")
	atsStr := fs.String("ats", "", "Comma-separated ATS list")
	fs.IntVar(&opts.limit, "limit", 0, "Max companies per ATS")
	fs.BoolVar(&opts.dryRun, "dry-run", false, "Preview without writing files")
	fs.IntVar(&opts.concurrency, "concurrency", 50, "Worker goroutine count")
	fs.StringVar(&opts.dataDir, "data-dir", "data", "Path to data directory")
	fs.BoolVar(&opts.verbose, "verbose", false, "Log per-board fetch failures")
	fs.Parse(os.Args[2:])

	if *atsStr != "" {
		opts.ats = strings.Split(*atsStr, ",")
	}

	if err := runScanATS(opts); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}
