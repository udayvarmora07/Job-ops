package main

import (
	"fmt"
)

func runScanATS(opts *scanATSOpts) error {
	fmt.Println("Reverse ATS scan not yet implemented.")
	fmt.Println("This will walk public company directories per ATS.")
	fmt.Println()
	fmt.Printf("Flags: since=%d, ats=%v, limit=%d, dry-run=%v, concurrency=%d, data-dir=%s\n",
		opts.since, opts.ats, opts.limit, opts.dryRun, opts.concurrency, opts.dataDir)
	return nil
}
