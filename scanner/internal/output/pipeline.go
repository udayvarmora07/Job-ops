package output

import (
	"fmt"
	"os"
	"strings"

	"github.com/santifer/jobops/scanner/internal/models"
)

func AppendToPipeline(path string, jobs []models.Job, dryRun bool, verbose bool) error {
	if len(jobs) == 0 {
		if verbose {
			fmt.Println("No new jobs to append to pipeline.")
		}
		return nil
	}

	var lines []string
	for _, j := range jobs {
		line := fmt.Sprintf("- [ ] %s | %s | %s", j.URL, j.Company, j.Title)
		lines = append(lines, line)
	}

	if dryRun {
		fmt.Println("--- Pipeline additions (dry-run) ---")
		for _, l := range lines {
			fmt.Println(l)
		}
		return nil
	}

	f, err := os.OpenFile(path, os.O_APPEND|os.O_WRONLY|os.O_CREATE, 0644)
	if err != nil {
		return fmt.Errorf("opening pipeline.md: %w", err)
	}
	defer f.Close()

	if _, err := f.WriteString("\n" + strings.Join(lines, "\n") + "\n"); err != nil {
		return fmt.Errorf("writing to pipeline.md: %w", err)
	}

	if verbose {
		fmt.Printf("Appended %d jobs to %s\n", len(jobs), path)
	}
	return nil
}
