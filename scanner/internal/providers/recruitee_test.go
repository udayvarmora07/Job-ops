package providers

import (
	"testing"
)

func TestParseRecruiteeResponse(t *testing.T) {
	offers := []struct {
		Title      string `json:"title"`
		CareersURL string `json:"careers_url"`
		URL        string `json:"url"`
		City       string `json:"city"`
		Country    string `json:"country"`
		Remote     bool   `json:"remote"`
		Location   string `json:"location"`
	}{
		{
			Title:      "DevOps Engineer",
			CareersURL: "https://acme.recruitee.com/o/devops-engineer",
			City:       "Bangalore",
			Country:    "India",
			Remote:     false,
		},
		{
			Title:      "SRE",
			CareersURL: "https://evil.com/trap",
			City:       "Remote",
			Country:    "",
			Remote:     true,
		},
		{
			Title:    "Platform Engineer",
			URL:      "https://beta.recruitee.com/o/platform",
			Location: "Remote, India",
		},
	}

	jobs := parseRecruiteeResponse(offers, "Acme")
	if len(jobs) != 3 {
		t.Fatalf("expected 3 jobs (2 valid URLs + 1 empty URL), got %d", len(jobs))
	}

	if jobs[0].Title != "DevOps Engineer" {
		t.Errorf("expected 'DevOps Engineer', got %q", jobs[0].Title)
	}
	if jobs[0].Location != "Bangalore, India" {
		t.Errorf("expected 'Bangalore, India', got %q", jobs[0].Location)
	}

	// Second job has an off-domain URL → url should be empty
	if jobs[1].URL != "" {
		t.Errorf("expected empty URL for evil.com domain, got %q", jobs[1].URL)
	}
	if jobs[1].Location != "Remote, Remote" {
		t.Errorf("expected 'Remote, Remote', got %q", jobs[1].Location)
	}

	if jobs[2].Title != "Platform Engineer" {
		t.Errorf("expected 'Platform Engineer', got %q", jobs[2].Title)
	}
	if jobs[2].Location != "Remote, India" {
		t.Errorf("expected 'Remote, India', got %q", jobs[2].Location)
	}
}
