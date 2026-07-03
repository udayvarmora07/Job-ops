package output

import (
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/santifer/jobops/scanner/internal/models"
)

func AppendToScanHistory(path string, jobs []models.Job, portal string, dryRun bool, verbose bool) error {
	if len(jobs) == 0 {
		return nil
	}

	today := time.Now().Format("2006-01-02")
	var lines []string
	for _, j := range jobs {
		line := fmt.Sprintf("%s\t%s\t%s\t%s\t%s\tadded\t%s",
			j.URL, today, portal, j.Title, j.Company, j.Location)
		lines = append(lines, line)
	}

	if dryRun {
		fmt.Println("--- Scan history additions (dry-run) ---")
		for _, l := range lines {
			fmt.Println(l)
		}
		return nil
	}

	f, err := os.OpenFile(path, os.O_APPEND|os.O_WRONLY|os.O_CREATE, 0644)
	if err != nil {
		return fmt.Errorf("opening scan-history.tsv: %w", err)
	}
	defer f.Close()

	if _, err := f.WriteString("\n" + strings.Join(lines, "\n") + "\n"); err != nil {
		return fmt.Errorf("writing to scan-history.tsv: %w", err)
	}

	if verbose {
		fmt.Printf("Appended %d entries to %s\n", len(jobs), path)
	}
	return nil
}
