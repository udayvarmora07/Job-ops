package providers

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/santifer/jobops/scanner/internal/models"
	"github.com/santifer/jobops/scanner/internal/provider"
)

func init() { provider.Register(&Lever{}) }

type Lever struct{}

func (l *Lever) ID() string { return "lever" }

func (l *Lever) Detect(entry *models.PortalEntry) bool {
	return resolveLeverAPIURL(entry) != ""
}

func (l *Lever) Fetch(entry *models.PortalEntry, ctx *provider.Context) ([]models.Job, error) {
	apiURL := resolveLeverAPIURL(entry)
	if apiURL == "" {
		return nil, fmt.Errorf("lever: cannot derive API URL for %s", entry.Name)
	}

	body, err := ctx.FetchJSON(apiURL, nil)
	if err != nil {
		return nil, err
	}

	var resp []struct {
		Text      string `json:"text"`
		HostedURL string `json:"hostedUrl"`
		CreatedAt int64  `json:"createdAt"`
		Categories *struct {
			Location string `json:"location"`
		} `json:"categories"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, err
	}

	var jobs []models.Job
	for _, j := range resp {
		job := models.Job{
			Title:   j.Text,
			URL:     j.HostedURL,
			Company: entry.Name,
		}
		if j.Categories != nil {
			job.Location = j.Categories.Location
		}
		if j.CreatedAt > 0 {
			job.PostedAt = j.CreatedAt
		}
		jobs = append(jobs, job)
	}
	return jobs, nil
}

func resolveLeverAPIURL(entry *models.PortalEntry) string {
	careersURL := entry.CareersURL
	if careersURL == "" {
		return ""
	}
	match := extractSubstring(careersURL, `jobs\.lever\.co/([^/?#]+)`)
	if match == "" {
		return ""
	}
	return fmt.Sprintf("https://api.lever.co/v0/postings/%s", match)
}

func extractSubstring(s, pattern string) string {
	idx := strings.Index(s, "jobs.lever.co/")
	if idx < 0 {
		return ""
	}
	rest := s[idx+14:]
	end := strings.IndexAny(rest, "/?#")
	if end < 0 {
		return rest
	}
	return rest[:end]
}
