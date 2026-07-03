package config

import (
	"testing"
)

func TestTitleFilter(t *testing.T) {
	tests := []struct {
		name     string
		cfg      *TitleFilterConfig
		title    string
		expected bool
	}{
		{
			name:     "nil config passes all",
			cfg:      nil,
			title:    "Anything",
			expected: true,
		},
		{
			name: "positive match",
			cfg: &TitleFilterConfig{
				Positive: []string{"DevOps", "SRE"},
			},
			title:    "Senior DevOps Engineer",
			expected: true,
		},
		{
			name: "positive no match",
			cfg: &TitleFilterConfig{
				Positive: []string{"DevOps", "SRE"},
			},
			title:    "Frontend Developer",
			expected: false,
		},
		{
			name: "negative blocks",
			cfg: &TitleFilterConfig{
				Positive: []string{"Engineer"},
				Negative: []string{"Junior"},
			},
			title:    "Junior Engineer",
			expected: false,
		},
		{
			name: "positive empty = pass all that aren't blocked",
			cfg: &TitleFilterConfig{
				Negative: []string{"Intern"},
			},
			title:    "DevOps Engineer",
			expected: true,
		},
		{
			name: "negative blocks Intern",
			cfg: &TitleFilterConfig{
				Negative: []string{"Intern"},
			},
			title:    "Software Engineer Intern",
			expected: false,
		},
		{
			name: "case insensitive",
			cfg: &TitleFilterConfig{
				Positive: []string{"devops"},
			},
			title:    "DevOps Engineer",
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f := BuildTitleFilter(tt.cfg)
			got := f.Match(tt.title)
			if got != tt.expected {
				t.Errorf("Match(%q) = %v, want %v", tt.title, got, tt.expected)
			}
		})
	}
}

func TestLocationFilter(t *testing.T) {
	tests := []struct {
		name     string
		cfg      *LocationFilterConfig
		location string
		expected bool
	}{
		{
			name:     "nil config passes all",
			cfg:      nil,
			location: "Somewhere",
			expected: true,
		},
		{
			name: "empty location passes",
			cfg: &LocationFilterConfig{
				Block: []string{"US"},
			},
			location: "",
			expected: true,
		},
		{
			name: "always_allow rescues multi-location",
			cfg: &LocationFilterConfig{
				AlwaysAllow: []string{"Bangalore"},
				Block:       []string{"US"},
			},
			location: "Remote, US or Bangalore",
			expected: true,
		},
		{
			name: "block rejects",
			cfg: &LocationFilterConfig{
				Block: []string{"US"},
			},
			location: "San Francisco, US",
			expected: false,
		},
		{
			name: "allow passes",
			cfg: &LocationFilterConfig{
				Allow: []string{"Remote"},
				Block: []string{"US"},
			},
			location: "Remote",
			expected: true,
		},
		{
			name: "allow requires match",
			cfg: &LocationFilterConfig{
				Allow: []string{"Remote"},
				Block: []string{"US"},
			},
			location: "Bangalore",
			expected: false,
		},
		{
			name: "empty allow and no block passes",
			cfg: &LocationFilterConfig{
				Allow: []string{},
				Block: []string{},
			},
			location: "Anywhere",
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f := BuildLocationFilter(tt.cfg)
			got := f.Match(tt.location)
			if got != tt.expected {
				t.Errorf("Match(%q) = %v, want %v", tt.location, got, tt.expected)
			}
		})
	}
}

func TestContentFilter(t *testing.T) {
	tests := []struct {
		name        string
		cfg         *ContentFilterConfig
		description string
		expected    bool
	}{
		{
			name:        "nil config passes",
			cfg:         nil,
			description: "Anything",
			expected:    true,
		},
		{
			name:        "empty description passes",
			cfg:         &ContentFilterConfig{Negative: []string{"PHP"}},
			description: "",
			expected:    true,
		},
		{
			name: "negative blocks",
			cfg: &ContentFilterConfig{
				Negative: []string{"PHP"},
			},
			description: "We use PHP and Laravel",
			expected:    false,
		},
		{
			name: "positive requires match",
			cfg: &ContentFilterConfig{
				Positive: []string{"Kubernetes"},
				Negative: []string{"PHP"},
			},
			description: "Kubernetes and Docker",
			expected:    true,
		},
		{
			name: "positive no match",
			cfg: &ContentFilterConfig{
				Positive: []string{"Rust"},
			},
			description: "Python and Go",
			expected:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f := BuildContentFilter(tt.cfg)
			got := f.Match(tt.description)
			if got != tt.expected {
				t.Errorf("Match(%q) = %v, want %v", tt.description, got, tt.expected)
			}
		})
	}
}

func TestSalaryFilter(t *testing.T) {
	tests := []struct {
		name     string
		cfg      *SalaryFilterConfig
		salary   *SalaryInfo
		expected bool
	}{
		{
			name:     "nil salary passes",
			cfg:      &SalaryFilterConfig{Min: 50000, Max: 200000},
			salary:   nil,
			expected: true,
		},
		{
			name:     "within range passes",
			cfg:      &SalaryFilterConfig{Min: 50000, Max: 200000, Currency: "USD"},
			salary:   &SalaryInfo{Min: 80000, Max: 150000, Currency: "USD"},
			expected: true,
		},
		{
			name:     "below min fails",
			cfg:      &SalaryFilterConfig{Min: 100000, Max: 200000},
			salary:   &SalaryInfo{Min: 30000, Max: 50000},
			expected: false,
		},
		{
			name:     "above max fails",
			cfg:      &SalaryFilterConfig{Min: 50000, Max: 100000},
			salary:   &SalaryInfo{Min: 150000, Max: 200000},
			expected: false,
		},
		{
			name:     "currency mismatch fails",
			cfg:      &SalaryFilterConfig{Min: 50000, Max: 200000, Currency: "USD"},
			salary:   &SalaryInfo{Min: 80000, Max: 150000, Currency: "EUR"},
			expected: false,
		},
		{
			name:     "overlap passes",
			cfg:      &SalaryFilterConfig{Min: 100000, Max: 200000},
			salary:   &SalaryInfo{Min: 80000, Max: 150000},
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f := BuildSalaryFilter(tt.cfg)
			got := f.MatchSalary(tt.salary)
			if got != tt.expected {
				t.Errorf("MatchSalary(%+v) = %v, want %v", tt.salary, got, tt.expected)
			}
		})
	}
}
