package config

import (
	"fmt"
	"os"

	"github.com/santifer/jobops/scanner/internal/models"
	"gopkg.in/yaml.v3"
)

type Config struct {
	TrackedCompanies []models.PortalEntry `yaml:"tracked_companies"`
	JobBoards        []models.PortalEntry `yaml:"job_boards"`
	TitleFilter      *TitleFilterConfig   `yaml:"title_filter"`
	LocationFilter   *LocationFilterConfig `yaml:"location_filter"`
	SalaryFilter     *SalaryFilterConfig  `yaml:"salary_filter"`
	ContentFilter    *ContentFilterConfig `yaml:"content_filter"`
	TrustFilter      *TrustFilterConfig   `yaml:"trust_filter"`
	ScanHistory      *ScanHistoryConfig   `yaml:"scan_history"`
	SkipTiers        []string             `yaml:"skip_tiers"`
	SearchQueries    []SearchQuery        `yaml:"search_queries"`
}

type TitleFilterConfig struct {
	Positive       []string `yaml:"positive"`
	Negative       []string `yaml:"negative"`
	SeniorityBoost []string `yaml:"seniority_boost"`
}

type LocationFilterConfig struct {
	AlwaysAllow []string `yaml:"always_allow"`
	Allow       []string `yaml:"allow"`
	Block       []string `yaml:"block"`
}

type SalaryFilterConfig struct {
	Min      float64 `yaml:"min"`
	Max      float64 `yaml:"max"`
	Currency string  `yaml:"currency"`
}

type ContentFilterConfig struct {
	Positive []string `yaml:"positive"`
	Negative []string `yaml:"negative"`
}

type TrustFilterConfig struct {
	MinScore float64 `yaml:"min_score"`
}

type ScanHistoryConfig struct {
	Policy string `yaml:"policy"`
}

type SearchQuery struct {
	Name    string `yaml:"name"`
	Query   string `yaml:"query"`
	Enabled bool   `yaml:"enabled"`
}

func LoadPortals(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("reading portals.yml: %w", err)
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parsing portals.yml: %w", err)
	}

	return &cfg, nil
}
