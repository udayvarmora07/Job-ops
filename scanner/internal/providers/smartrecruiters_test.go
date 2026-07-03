package providers

import (
	"testing"
)

func TestParseSmartRecruitersResponse(t *testing.T) {
	items := []struct {
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
	}{
		{
			ID:   "123",
			Name: "DevOps Engineer",
			Ref:  "https://api.smartrecruiters.com/v1/companies/Acme/postings/123",
			Location: &struct {
				FullLocation string `json:"fullLocation"`
				City         string `json:"city"`
				Region       string `json:"region"`
				Country      string `json:"country"`
				Remote       bool   `json:"remote"`
			}{
				FullLocation: "Bangalore, India",
			},
		},
		{
			ID:   "456",
			Name: "SRE",
			Location: &struct {
				FullLocation string `json:"fullLocation"`
				City         string `json:"city"`
				Region       string `json:"region"`
				Country      string `json:"country"`
				Remote       bool   `json:"remote"`
			}{
				City:   "Remote",
				Remote: true,
			},
		},
	}

	jobs := parseSmartRecruitersResponse(items, "Acme", "Acme")
	if len(jobs) != 2 {
		t.Fatalf("expected 2 jobs, got %d", len(jobs))
	}

	if jobs[0].Title != "DevOps Engineer" {
		t.Errorf("expected 'DevOps Engineer', got %q", jobs[0].Title)
	}
	if jobs[0].Location != "Bangalore, India" {
		t.Errorf("expected 'Bangalore, India', got %q", jobs[0].Location)
	}
	if jobs[0].URL != "https://jobs.smartrecruiters.com/Acme/postings/123" {
		t.Errorf("unexpected URL: %s", jobs[0].URL)
	}

	if jobs[1].Location != "Remote, Remote" {
		t.Errorf("expected 'Remote, Remote', got %q", jobs[1].Location)
	}
}
