package providers

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strings"

	"github.com/santifer/jobops/scanner/internal/models"
	"github.com/santifer/jobops/scanner/internal/provider"
)

func init() { provider.Register(&SmartRecruiters{}) }

type SmartRecruiters struct{}

const (
	srPageSize = 100
	srMaxPages = 50
)

var allowedSRHosts = map[string]bool{
	"api.smartrecruiters.com": true,
}

var srCareersHosts = map[string]bool{
	"careers.smartrecruiters.com": true,
	"jobs.smartrecruiters.com":    true,
}

func (s *SmartRecruiters) ID() string { return "smartrecruiters" }

func (s *SmartRecruiters) Detect(entry *models.PortalEntry) bool {
	return resolveSRSlug(entry) != ""
}

func (s *SmartRecruiters) Fetch(entry *models.PortalEntry, ctx *provider.Context) ([]models.Job, error) {
	slug := resolveSRSlug(entry)
	if slug == "" {
		return nil, fmt.Errorf("smartrecruiters: cannot derive API URL for %s", entry.Name)
	}

	var all []models.Job
	for page := 0; page < srMaxPages; page++ {
		apiURL := fmt.Sprintf("https://api.smartrecruiters.com/v1/companies/%s/postings?limit=%d&offset=%d&status=PUBLIC", slug, srPageSize, page*srPageSize)
		body, err := ctx.FetchJSON(apiURL, &provider.RequestOptions{Redirect: "error"})
		if err != nil {
			return nil, err
		}

		var resp struct {
			Content []struct {
				ID   string `json:"id"`
				Name string `json:"name"`
				Ref  string `json:"ref"`
				Location *struct {
					FullLocation string `json:"fullLocation"`
					City         string `json:"city"`
					Region       string `json:"region"`
					Country      string `json:"country"`
					Remote       bool   `json:"remote"`
				} `json:"location"`
			} `json:"content"`
		}
		if err := json.Unmarshal(body, &resp); err != nil {
			return nil, err
		}

		parsed := parseSmartRecruitersResponse(resp.Content, entry.Name, slug)
		if len(parsed) == 0 {
			break
		}
		all = append(all, parsed...)
		if len(parsed) < srPageSize {
			break
		}
	}
	return all, nil
}

func resolveSRSlug(entry *models.PortalEntry) string {
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
	if !srCareersHosts[parsed.Hostname()] {
		return ""
	}
	parts := strings.Split(strings.Trim(parsed.Path, "/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		return ""
	}
	return parts[0]
}

func parseSmartRecruitersResponse(items []struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Ref      string `json:"ref"`
	Location *struct {
		FullLocation string `json:"fullLocation"`
		City         string `json:"city"`
		Region       string `json:"region"`
		Country      string `json:"country"`
		Remote       bool   `json:"remote"`
	} `json:"location"`
}, companyName, slug string) []models.Job {
	var jobs []models.Job
	for _, j := range items {
		var location string
		if j.Location != nil {
			fullLocation := j.Location.FullLocation
			if fullLocation == "" {
				parts := []string{j.Location.City, j.Location.Region, j.Location.Country}
				var nonEmpty []string
				for _, p := range parts {
					if p != "" {
						nonEmpty = append(nonEmpty, p)
					}
				}
				fullLocation = strings.Join(nonEmpty, ", ")
			}
			if j.Location.Remote {
				if fullLocation != "" {
					fullLocation += ", Remote"
				} else {
					fullLocation = "Remote"
				}
			}
			location = fullLocation
		}

		jobURL := ""
		if j.Ref != "" {
			if parsedRef, err := url.Parse(j.Ref); err == nil {
				if parsedRef.Scheme == "https" && parsedRef.Hostname() == "api.smartrecruiters.com" && strings.HasPrefix(parsedRef.Path, "/v1/companies/") {
					restOfPath := strings.TrimPrefix(parsedRef.Path, "/v1/companies/")
					jobURL = fmt.Sprintf("https://jobs.smartrecruiters.com/%s", restOfPath)
				}
			}
		}
		if jobURL == "" && j.ID != "" {
			companySlug := slug
			if companySlug == "" {
				companySlug = strings.ToLower(strings.ReplaceAll(companyName, " ", "-"))
			}
			nameSlug := strings.ToLower(strings.ReplaceAll(j.Name, " ", "-"))
			jobURL = fmt.Sprintf("https://jobs.smartrecruiters.com/%s/%s-%s", companySlug, j.ID, nameSlug)
		}

		jobs = append(jobs, models.Job{
			Title:    j.Name,
			URL:      jobURL,
			Location: location,
			Company:  companyName,
		})
	}
	return jobs
}
