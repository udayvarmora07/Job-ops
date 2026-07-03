package providers

import (
	"encoding/json"
	"fmt"
	"math"
	"math/rand"
	"strings"
	"time"

	"github.com/santifer/jobops/scanner/internal/models"
	"github.com/santifer/jobops/scanner/internal/provider"
)

func init() { provider.Register(&Ashby{}) }

type Ashby struct{}

const (
	ashbyTimeoutMs = 30000
	ashbyRetries   = 2
)

var intervalMultipliers = map[string]float64{
	"1 HOUR":  2080,
	"1 DAY":   260,
	"1 WEEK":  52,
	"2 WEEK":  26,
	"0.5 MONTH": 24,
	"1 MONTH": 12,
	"2 MONTH": 6,
	"3 MONTH": 4,
	"6 MONTH": 2,
	"1 YEAR":  1,
}

func (a *Ashby) ID() string { return "ashby" }

func (a *Ashby) Detect(entry *models.PortalEntry) bool {
	return resolveAshbyAPIURL(entry) != ""
}

func (a *Ashby) Fetch(entry *models.PortalEntry, ctx *provider.Context) ([]models.Job, error) {
	apiURL := resolveAshbyAPIURL(entry)
	if apiURL == "" {
		return nil, fmt.Errorf("ashby: cannot derive API URL for %s", entry.Name)
	}

	var lastErr error
	for attempt := 0; attempt <= ashbyRetries; attempt++ {
		if attempt > 0 {
			backoff := time.Duration(1000*(1<<(attempt-1))+rand.Intn(500)) * time.Millisecond
			time.Sleep(backoff)
		}
		body, err := ctx.FetchJSON(apiURL, &provider.RequestOptions{
			Timeout: ashbyTimeoutMs * time.Millisecond,
		})
		if err != nil {
			lastErr = err
			continue
		}

		var resp struct {
			Jobs []struct {
				Title       string `json:"title"`
				JobURL      string `json:"jobUrl"`
				Location    string `json:"location"`
				PublishedAt string `json:"publishedAt"`
				Compensation *struct {
					Interval string `json:"interval"`
					MinValue any    `json:"minValue"`
					MaxValue any    `json:"maxValue"`
					Currency string `json:"currency"`
				} `json:"compensation"`
			} `json:"jobs"`
		}
		if err := json.Unmarshal(body, &resp); err != nil {
			return nil, err
		}

		var jobs []models.Job
		for _, j := range resp.Jobs {
			job := models.Job{
				Title:   j.Title,
				URL:     j.JobURL,
				Company: entry.Name,
				Location: j.Location,
			}
			if j.PublishedAt != "" {
				if t, err := time.Parse(time.RFC3339, j.PublishedAt); err == nil {
					job.PostedAt = t.UnixMilli()
				}
			}
			if j.Compensation != nil {
				job.Salary = parseAshbyCompensation(j.Compensation)
			}
			jobs = append(jobs, job)
		}
		return jobs, nil
	}
	return nil, lastErr
}

func parseAshbyCompensation(comp *struct {
	Interval string `json:"interval"`
	MinValue any    `json:"minValue"`
	MaxValue any    `json:"maxValue"`
	Currency string `json:"currency"`
}) *models.Salary {
	if comp == nil {
		return nil
	}

	multiplier, ok := intervalMultipliers[comp.Interval]
	if !ok {
		multiplier = 1
	}

	normalizeNum := func(v any) *float64 {
		if v == nil {
			return nil
		}
		switch n := v.(type) {
		case float64:
			if math.IsInf(n, 0) || math.IsNaN(n) || n < 0 {
				return nil
			}
			return &n
		case int:
			f := float64(n)
			if f < 0 {
				return nil
			}
			return &f
		case string:
			if n == "" {
				return nil
			}
			return nil
		default:
			return nil
		}
	}

	minVal := normalizeNum(comp.MinValue)
	maxVal := normalizeNum(comp.MaxValue)

	if minVal == nil && maxVal == nil {
		return nil
	}

	var min, max float64
	if minVal != nil {
		min = *minVal * multiplier
	} else {
		min = *maxVal * multiplier
	}
	if maxVal != nil {
		max = *maxVal * multiplier
	} else {
		max = *minVal * multiplier
	}

	currency := strings.ToUpper(strings.TrimSpace(comp.Currency))

	return &models.Salary{
		Min:      math.Min(min, max),
		Max:      math.Max(min, max),
		Currency: currency,
	}
}

func resolveAshbyAPIURL(entry *models.PortalEntry) string {
	careersURL := entry.CareersURL
	if careersURL == "" {
		return ""
	}
	idx := strings.Index(careersURL, "jobs.ashbyhq.com/")
	if idx < 0 {
		return ""
	}
	rest := careersURL[idx+17:]
	end := strings.IndexAny(rest, "/?#")
	if end < 0 {
		return ""
	}
	slug := rest[:end]
	if slug == "" {
		return ""
	}
	return fmt.Sprintf("https://api.ashbyhq.com/posting-api/job-board/%s?includeCompensation=true", slug)
}
