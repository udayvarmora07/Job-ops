package providers

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/santifer/jobops/scanner/internal/models"
	"github.com/santifer/jobops/scanner/internal/provider"
)

func init() { provider.Register(&Workable{}) }

type Workable struct{}

var allowedWorkableHosts = map[string]bool{
	"apply.workable.com": true,
}

func (w *Workable) ID() string { return "workable" }

func (w *Workable) Detect(entry *models.PortalEntry) bool {
	return resolveWorkableFeedURL(entry) != ""
}

func (w *Workable) Fetch(entry *models.PortalEntry, ctx *provider.Context) ([]models.Job, error) {
	feedURL := resolveWorkableFeedURL(entry)
	if feedURL == "" {
		return nil, fmt.Errorf("workable: cannot derive feed URL for %s", entry.Name)
	}

	text, err := ctx.FetchText(feedURL, &provider.RequestOptions{Redirect: "error"})
	if err != nil {
		return nil, err
	}

	return parseWorkableMarkdown(text, entry.Name), nil
}

func resolveWorkableFeedURL(entry *models.PortalEntry) string {
	raw := entry.CareersURL
	if raw == "" {
		return ""
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return ""
	}
	if parsed.Scheme != "https" {
		return ""
	}
	if !allowedWorkableHosts[parsed.Hostname()] {
		return ""
	}
	parts := strings.Split(strings.Trim(parsed.Path, "/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		return ""
	}
	return fmt.Sprintf("https://apply.workable.com/%s/jobs.md", parts[0])
}

func parseWorkableMarkdown(text, companyName string) []models.Job {
	if text == "" {
		return nil
	}
	var jobs []models.Job
	for _, line := range strings.Split(text, "\n") {
		if !strings.HasPrefix(line, "|") || !strings.Contains(line, "[View]") {
			continue
		}
		cols := strings.Split(line, "|")
		for i := range cols {
			cols[i] = strings.TrimSpace(cols[i])
		}
		if len(cols) < 8 {
			continue
		}
		title := cols[1]
		if title == "" || title == "Title" {
			continue
		}
		location := cols[3]

		urlMatch := extractViewLink(line)
		if urlMatch == "" {
			continue
		}
		jobURL := strings.TrimSuffix(urlMatch, ".md")

		parsed, err := url.Parse(jobURL)
		if err != nil || parsed.Scheme != "https" || parsed.Hostname() != "apply.workable.com" {
			continue
		}

		jobs = append(jobs, models.Job{
			Title:    title,
			URL:      jobURL,
			Location: location,
			Company:  companyName,
		})
	}
	return jobs
}

func extractViewLink(line string) string {
	idx := strings.Index(line, "[View](")
	if idx < 0 {
		return ""
	}
	start := idx + 7
	end := strings.Index(line[start:], ")")
	if end < 0 {
		return ""
	}
	return line[start : start+end]
}
