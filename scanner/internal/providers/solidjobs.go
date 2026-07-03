package providers

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strings"

	"github.com/santifer/jobops/scanner/internal/models"
	"github.com/santifer/jobops/scanner/internal/provider"
)

func init() { provider.Register(&SolidJobs{}) }

type SolidJobs struct{}

var allowedSolidJobsHosts = map[string]bool{
	"solid.jobs": true,
}

func (s *SolidJobs) ID() string { return "solidjobs" }

func (s *SolidJobs) Detect(entry *models.PortalEntry) bool {
	raw := entry.CareersURL
	if raw == "" {
		return false
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return false
	}
	return parsed.Hostname() == "solid.jobs" && strings.HasPrefix(parsed.Path, "/public-api/offers/")
}

func (s *SolidJobs) Fetch(entry *models.PortalEntry, ctx *provider.Context) ([]models.Job, error) {
	raw := entry.CareersURL
	if raw == "" {
		return nil, fmt.Errorf("solidjobs: careers_url required")
	}

	parsed, err := url.Parse(raw)
	if err != nil {
		return nil, fmt.Errorf("solidjobs: invalid URL: %s", raw)
	}
	if parsed.Scheme != "https" {
		return nil, fmt.Errorf("solidjobs: URL must use HTTPS: %s", raw)
	}
	if !allowedSolidJobsHosts[parsed.Hostname()] {
		return nil, fmt.Errorf("solidjobs: untrusted hostname %q — must be solid.jobs", parsed.Hostname())
	}
	if !strings.HasPrefix(parsed.Path, "/public-api/offers/") {
		return nil, fmt.Errorf("solidjobs: URL path must start with /public-api/offers/: %s", raw)
	}

	body, err := ctx.FetchJSON(raw, &provider.RequestOptions{Redirect: "error"})
	if err != nil {
		return nil, err
	}

	var resp struct {
		Jobs []struct {
			Title     string   `json:"title"`
			URL       string   `json:"url"`
			Company   string   `json:"company"`
			Locations []string `json:"locations"`
		} `json:"jobs"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("solidjobs: unexpected API response: %w", err)
	}

	var jobs []models.Job
	for _, j := range resp.Jobs {
		if j.URL == "" {
			continue
		}
		company := j.Company
		if company == "" {
			company = entry.Name
		}
		location := ""
		if len(j.Locations) > 0 {
			location = strings.Join(j.Locations, ", ")
		}
		jobs = append(jobs, models.Job{
			Title:    j.Title,
			URL:      j.URL,
			Company:  company,
			Location: location,
		})
	}
	return jobs, nil
}
