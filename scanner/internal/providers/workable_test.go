package providers

import (
	"testing"
)

func TestParseWorkableMarkdown(t *testing.T) {
	md := `| Title | Department | Location | Type | Salary | Posted | Details |
|------|-----------|----------|------|--------|--------|---------|
| DevOps Engineer | Engineering | Remote | Full-time | $100k | 2 days ago | [View](https://apply.workable.com/acme/jobs/view/123.md) |
| SRE | Engineering | Bangalore | Full-time | $80k | 1 week ago | [View](https://apply.workable.com/acme/jobs/view/456.md) |
| Skip Row | Engineering | US | Full-time | $120k | 3 days ago | [View](https://evil.com/trap.md) |`

	jobs := parseWorkableMarkdown(md, "Acme")
	if len(jobs) != 2 {
		t.Fatalf("expected 2 jobs, got %d", len(jobs))
	}

	if jobs[0].Title != "DevOps Engineer" {
		t.Errorf("expected title 'DevOps Engineer', got %q", jobs[0].Title)
	}
	if jobs[0].Location != "Remote" {
		t.Errorf("expected location 'Remote', got %q", jobs[0].Location)
	}
	if jobs[0].URL != "https://apply.workable.com/acme/jobs/view/123" {
		t.Errorf("unexpected URL: %s", jobs[0].URL)
	}
	if jobs[0].Company != "Acme" {
		t.Errorf("expected company 'Acme', got %q", jobs[0].Company)
	}

	if jobs[1].Title != "SRE" {
		t.Errorf("expected title 'SRE', got %q", jobs[1].Title)
	}
}

func TestParseWorkableMarkdownEmpty(t *testing.T) {
	jobs := parseWorkableMarkdown("", "Test")
	if len(jobs) != 0 {
		t.Errorf("expected 0 jobs for empty input, got %d", len(jobs))
	}
}
