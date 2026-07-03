package main

import (
	"fmt"
	"path/filepath"
	"strings"
	"sync"

	"github.com/santifer/jobops/scanner/internal/config"
	"github.com/santifer/jobops/scanner/internal/dedup"
	"github.com/santifer/jobops/scanner/internal/models"
	"github.com/santifer/jobops/scanner/internal/output"
	"github.com/santifer/jobops/scanner/internal/provider"
	_ "github.com/santifer/jobops/scanner/internal/providers"
)

type fetchResult struct {
	entry *models.PortalEntry
	jobs  []models.Job
	err   error
}

func runScan(opts *scanOpts) error {
	cfg, err := config.LoadPortals(opts.configPath)
	if err != nil {
		return fmt.Errorf("loading config: %w", err)
	}

	ctx := provider.NewContext(0)
	ctx.SetVerbose(opts.verbose)

	providers := provider.All()
	if len(providers) == 0 {
		return fmt.Errorf("no providers loaded")
	}

	titleFilter := config.BuildTitleFilter(cfg.TitleFilter)
	locationFilter := config.BuildLocationFilter(cfg.LocationFilter)
	contentFilter := config.BuildContentFilter(cfg.ContentFilter)
	scanHistoryPath := filepath.Join(opts.dataDir, "scan-history.tsv")
	pipelinePath := filepath.Join(opts.dataDir, "pipeline.md")

	seenSet, err := dedup.LoadScanHistory(scanHistoryPath)
	if err != nil {
		return fmt.Errorf("loading scan history: %w", err)
	}

	var entries []*models.PortalEntry
	for i := range cfg.TrackedCompanies {
		entry := &cfg.TrackedCompanies[i]
		if !entry.Enabled {
			continue
		}
		if opts.company != "" && !strings.Contains(strings.ToLower(entry.Name), strings.ToLower(opts.company)) {
			continue
		}
		entries = append(entries, entry)
	}
	for i := range cfg.JobBoards {
		entry := &cfg.JobBoards[i]
		if !entry.Enabled {
			continue
		}
		if opts.company != "" && !strings.Contains(strings.ToLower(entry.Name), strings.ToLower(opts.company)) {
			continue
		}
		entries = append(entries, entry)
	}

	if len(entries) == 0 {
		fmt.Println("No enabled entries to scan.")
		return nil
	}

	if opts.verbose {
		fmt.Printf("Scanning %d entries with %d workers...\n", len(entries), opts.concurrency)
	}

	results := parallelFetch(ctx, entries, providers, opts.concurrency)

	var newJobs []models.Job
	var totalFetched int
	var totalErrors int

	for _, r := range results {
		if r.err != nil {
			totalErrors++
			if opts.verbose {
				fmt.Printf("  ✗ %s: %v\n", r.entry.Name, r.err)
			}
			continue
		}
		totalFetched += len(r.jobs)
		for _, j := range r.jobs {
			if !titleFilter.Match(j.Title) {
				continue
			}
			if !locationFilter.Match(j.Location) {
				continue
			}
			if !contentFilter.Match(j.Description) {
				continue
			}
			if seenSet.Seen(j.URL) {
				continue
			}
			seenSet.Add(j.URL)
			newJobs = append(newJobs, j)
		}
	}

	if opts.verbose {
		fmt.Printf("\nResults: %d fetched, %d new, %d errors\n", totalFetched, len(newJobs), totalErrors)
	}

	if err := output.AppendToPipeline(pipelinePath, newJobs, opts.dryRun, opts.verbose); err != nil {
		return fmt.Errorf("writing pipeline: %w", err)
	}

	portalName := "go-scanner"
	if err := output.AppendToScanHistory(scanHistoryPath, newJobs, portalName, opts.dryRun, opts.verbose); err != nil {
		return fmt.Errorf("writing scan history: %w", err)
	}

	if len(newJobs) > 0 && !opts.dryRun {
		fmt.Printf("Added %d new job(s) to pipeline.\n", len(newJobs))
	} else if len(newJobs) == 0 && opts.verbose {
		fmt.Println("No new jobs found.")
	}

	return nil
}

func parallelFetch(ctx *provider.Context, entries []*models.PortalEntry, providers []provider.Provider, concurrency int) []fetchResult {
	results := make([]fetchResult, 0, len(entries))
	var mu sync.Mutex
	sem := make(chan struct{}, concurrency)
	var wg sync.WaitGroup

	for _, entry := range entries {
		sem <- struct{}{}
		wg.Add(1)
		go func(e *models.PortalEntry) {
			defer wg.Done()
			defer func() { <-sem }()

			p, ok := provider.Detect(e)
			if !ok {
				mu.Lock()
				results = append(results, fetchResult{entry: e, err: fmt.Errorf("no provider detected")})
				mu.Unlock()
				return
			}

			jobs, err := p.Fetch(e, ctx)
			mu.Lock()
			results = append(results, fetchResult{entry: e, jobs: jobs, err: err})
			mu.Unlock()
		}(entry)
	}

	wg.Wait()
	return results
}
