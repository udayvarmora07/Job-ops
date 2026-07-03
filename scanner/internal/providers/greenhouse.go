package providers

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/santifer/jobops/scanner/internal/models"
	"github.com/santifer/jobops/scanner/internal/provider"
)

func init() { provider.Register(&Greenhouse{}) }

type Greenhouse struct{}

var allowedGreenhouseHosts = map[string]bool{
	"boards-api.greenhouse.io":    true,
	"boards.greenhouse.io":        true,
	"job-boards.greenhouse.io":    true,
	"job-boards.eu.greenhouse.io": true,
}

func (g *Greenhouse) ID() string { return "greenhouse" }

func (g *Greenhouse) Detect(entry *models.PortalEntry) bool {
	apiURL := resolveGreenhouseAPIURL(entry)
	return apiURL != ""
}

func (g *Greenhouse) Fetch(entry *models.PortalEntry, ctx *provider.Context) ([]models.Job, error) {
	apiURL := resolveGreenhouseAPIURL(entry)
	if apiURL == "" {
		return nil, fmt.Errorf("greenhouse: cannot derive API URL for %s", entry.Name)
	}

	body, err := ctx.FetchJSON(apiURL, &provider.RequestOptions{Redirect: "error"})
	if err != nil {
		return nil, err
	}

	var resp struct {
		Jobs []struct {
			Title          string `json:"title"`
			AbsoluteURL    string `json:"absolute_url"`
			Location       *struct {
				Name string `json:"name"`
			} `json:"location"`
			FirstPublished string `json:"first_published"`
		} `json:"jobs"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, err
	}

	var jobs []models.Job
	for _, j := range resp.Jobs {
		if j.AbsoluteURL == "" {
			continue
		}
		job := models.Job{
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

func resolveGreenhouseAPIURL(entry *models.PortalEntry) string {
	if entry.API != "" {
		return entry.API
	}
	careersURL := entry.CareersURL
	if careersURL == "" {
		return ""
	}
	parsed, err := url.Parse(careersURL)
	if err != nil {
		return ""
	}
	if !allowedGreenhouseHosts[parsed.Hostname()] {
		return ""
	}
	parts := strings.Split(strings.Trim(parsed.Path, "/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		return ""
	}
	return fmt.Sprintf("https://boards-api.greenhouse.io/v1/boards/%s/jobs", parts[0])
}
