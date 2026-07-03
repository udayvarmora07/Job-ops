package providers

import (
	"encoding/json"
	"fmt"
	"net/url"
	"regexp"
	"strings"

	"github.com/santifer/jobops/scanner/internal/models"
	"github.com/santifer/jobops/scanner/internal/provider"
)

func init() { provider.Register(&Recruitee{}) }

type Recruitee struct{}

var recruiteeHostRE = regexp.MustCompile(`^[a-z0-9][a-z0-9-]*\.recruitee\.com$`)

func (r *Recruitee) ID() string { return "recruitee" }

func (r *Recruitee) Detect(entry *models.PortalEntry) bool {
	return resolveRecruiteeAPIURL(entry) != ""
}

func (r *Recruitee) Fetch(entry *models.PortalEntry, ctx *provider.Context) ([]models.Job, error) {
	apiURL := resolveRecruiteeAPIURL(entry)
	if apiURL == "" {
		return nil, fmt.Errorf("recruitee: cannot derive API URL for %s", entry.Name)
	}

	body, err := ctx.FetchJSON(apiURL, &provider.RequestOptions{Redirect: "error"})
	if err != nil {
		return nil, err
	}

	var resp struct {
		Offers []struct {
			Title      string `json:"title"`
			CareersURL string `json:"careers_url"`
			URL        string `json:"url"`
			City       string `json:"city"`
			Country    string `json:"country"`
			Remote     bool   `json:"remote"`
			Location   string `json:"location"`
		} `json:"offers"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, err
	}

	return parseRecruiteeResponse(resp.Offers, entry.Name), nil
}

func resolveRecruiteeAPIURL(entry *models.PortalEntry) string {
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
	if !recruiteeHostRE.MatchString(parsed.Hostname()) {
		return ""
	}
	return fmt.Sprintf("https://%s/api/offers/", parsed.Hostname())
}

func parseRecruiteeResponse(offers []struct {
	Title      string `json:"title"`
	CareersURL string `json:"careers_url"`
	URL        string `json:"url"`
	City       string `json:"city"`
	Country    string `json:"country"`
	Remote     bool   `json:"remote"`
	Location   string `json:"location"`
}, companyName string) []models.Job {
	var jobs []models.Job
	for _, j := range offers {
		city := strings.TrimSpace(j.City)
		country := strings.TrimSpace(j.Country)
		remote := ""
		if j.Remote {
			remote = "Remote"
		}
		location := j.Location
		if location == "" {
			parts := []string{city, country, remote}
			var nonEmpty []string
			for _, p := range parts {
				if p != "" {
					nonEmpty = append(nonEmpty, p)
				}
			}
			location = strings.Join(nonEmpty, ", ")
		}

		jobURL := ""
		rawURL := j.CareersURL
		if rawURL == "" {
			rawURL = j.URL
		}
		if rawURL != "" {
			if parsed, err := url.Parse(rawURL); err == nil {
				if parsed.Scheme == "https" && recruiteeHostRE.MatchString(parsed.Hostname()) {
					jobURL = parsed.String()
				}
			}
		}

		jobs = append(jobs, models.Job{
			Title:    j.Title,
			URL:      jobURL,
			Location: location,
			Company:  companyName,
		})
	}
	return jobs
}
