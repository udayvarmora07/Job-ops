package providers

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/santifer/jobops/scanner/internal/models"
	"github.com/santifer/jobops/scanner/internal/provider"
)

func init() { provider.Register(&Workday{}) }

type Workday struct{}

const (
	workdayPageSize = 20
	workdayMaxPages = 50
)

var workdayRE = regexp.MustCompile(`^https://([\w-]+)\.(wd[\w-]*)\.myworkdayjobs\.com/(?:[a-z]{2}-[A-Z]{2}/)?([^/?#]+)`)

type workdayEndpoint struct {
	api     string
	jobBase string
}

func (w *Workday) ID() string { return "workday" }

func (w *Workday) Detect(entry *models.PortalEntry) bool {
	return resolveWorkdayEndpoint(entry) != nil
}

func (w *Workday) Fetch(entry *models.PortalEntry, ctx *provider.Context) ([]models.Job, error) {
	ep := resolveWorkdayEndpoint(entry)
	if ep == nil {
		return nil, fmt.Errorf("workday: cannot derive CXS endpoint for %s", entry.Name)
	}

	var jobs []models.Job
	for page := 0; page < workdayMaxPages; page++ {
		payload := map[string]any{
			"limit":         workdayPageSize,
			"offset":        page * workdayPageSize,
			"searchText":    "",
			"appliedFacets": map[string]any{},
		}
		bodyBytes, _ := json.Marshal(payload)
		body := string(bodyBytes)

		resp, err := ctx.FetchJSON(ep.api, &provider.RequestOptions{
			Method: "POST",
			Body:   body,
			Headers: map[string]string{
				"Content-Type": "application/json",
				"Accept":       "application/json",
			},
		})
		if err != nil {
			return nil, err
		}

		var result struct {
			JobPostings []struct {
				Title         string `json:"title"`
				ExternalPath  string `json:"externalPath"`
				LocationsText string `json:"locationsText"`
				PostedOn      string `json:"postedOn"`
			} `json:"jobPostings"`
		}
		if err := json.Unmarshal(resp, &result); err != nil {
			return nil, err
		}

		for _, j := range result.JobPostings {
			if j.ExternalPath == "" {
				continue
			}
			job := models.Job{
				Title:    j.Title,
				URL:      ep.jobBase + j.ExternalPath,
				Company:  entry.Name,
				Location: j.LocationsText,
				PostedAt: parseWorkdayPostedOn(j.PostedOn),
			}
			jobs = append(jobs, job)
		}

		if len(result.JobPostings) < workdayPageSize {
			break
		}
	}
	return jobs, nil
}

func resolveWorkdayEndpoint(entry *models.PortalEntry) *workdayEndpoint {
	careersURL := entry.CareersURL
	if careersURL == "" {
		return nil
	}
	m := workdayRE.FindStringSubmatch(careersURL)
	if m == nil {
		return nil
	}
	tenant, instance, site := m[1], m[2], m[3]
	origin := fmt.Sprintf("https://%s.%s.myworkdayjobs.com", tenant, instance)
	return &workdayEndpoint{
		api:     fmt.Sprintf("%s/wday/cxs/%s/%s/jobs", origin, tenant, site),
		jobBase: fmt.Sprintf("%s/%s", origin, site),
	}
}

func parseWorkdayPostedOn(label string) int64 {
	if label == "" {
		return 0
	}
	lower := strings.ToLower(label)
	if strings.Contains(lower, "posted today") {
		return time.Now().UnixMilli()
	}
	if strings.Contains(lower, "posted yesterday") {
		return time.Now().Add(-24 * time.Hour).UnixMilli()
	}
	re := regexp.MustCompile(`posted\s+(\d+)\+?\s*day`)
	m := re.FindStringSubmatch(lower)
	if m == nil {
		return 0
	}
	if strings.Contains(m[0], "+") {
		return 0
	}
	var days int
	fmt.Sscanf(m[1], "%d", &days)
	return time.Now().Add(-time.Duration(days) * 24 * time.Hour).UnixMilli()
}
