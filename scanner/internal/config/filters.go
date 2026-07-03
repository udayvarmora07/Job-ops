package config

import (
	"regexp"
	"strings"
)

type TitleFilter struct {
	positive []*regexp.Regexp
	negative []*regexp.Regexp
}

func (f *TitleFilter) Match(title string) bool {
	lower := strings.ToLower(title)
	hasPos := len(f.positive) == 0
	for _, re := range f.positive {
		if re.MatchString(lower) {
			hasPos = true
			break
		}
	}
	for _, re := range f.negative {
		if re.MatchString(lower) {
			return false
		}
	}
	return hasPos
}

func BuildTitleFilter(cfg *TitleFilterConfig) *TitleFilter {
	f := &TitleFilter{}
	if cfg == nil {
		return f
	}
	for _, kw := range cfg.Positive {
		f.positive = append(f.positive, compileKeyword(kw))
	}
	for _, kw := range cfg.Negative {
		f.negative = append(f.negative, compileKeyword(kw))
	}
	return f
}

func compileKeyword(kw string) *regexp.Regexp {
	kw = strings.TrimSpace(strings.ToLower(kw))
	if kw == "" {
		return regexp.MustCompile(`(?!)`) // never match
	}
	if len(kw) >= 2 && len(kw) <= 3 {
		isAlpha := true
		for _, r := range kw {
			if r < 'a' || r > 'z' {
				isAlpha = false
				break
			}
		}
		if isAlpha {
			return regexp.MustCompile(`\b` + regexp.QuoteMeta(kw) + `\b`)
		}
	}
	return regexp.MustCompile(regexp.QuoteMeta(kw))
}

type LocationFilter struct {
	alwaysAllow []string
	allow       []string
	block       []string
}

func (f *LocationFilter) Match(location string) bool {
	if location == "" {
		return true
	}
	lower := strings.ToLower(location)
	for _, k := range f.alwaysAllow {
		if strings.Contains(lower, k) {
			return true
		}
	}
	for _, k := range f.block {
		if strings.Contains(lower, k) {
			return false
		}
	}
	if len(f.allow) == 0 {
		return true
	}
	for _, k := range f.allow {
		if strings.Contains(lower, k) {
			return true
		}
	}
	return false
}

func BuildLocationFilter(cfg *LocationFilterConfig) *LocationFilter {
	f := &LocationFilter{}
	if cfg == nil {
		return f
	}
	f.alwaysAllow = normalizeKeywords(cfg.AlwaysAllow)
	f.allow = normalizeKeywords(cfg.Allow)
	f.block = normalizeKeywords(cfg.Block)
	return f
}

type ContentFilter struct {
	positive []string
	negative []string
}

func (f *ContentFilter) Match(description string) bool {
	if description == "" {
		return true
	}
	lower := strings.ToLower(description)
	for _, k := range f.negative {
		if strings.Contains(lower, k) {
			return false
		}
	}
	if len(f.positive) == 0 {
		return true
	}
	for _, k := range f.positive {
		if strings.Contains(lower, k) {
			return true
		}
	}
	return false
}

func BuildContentFilter(cfg *ContentFilterConfig) *ContentFilter {
	f := &ContentFilter{}
	if cfg == nil {
		return f
	}
	f.positive = normalizeKeywords(cfg.Positive)
	f.negative = normalizeKeywords(cfg.Negative)
	return f
}

type SalaryFilter struct {
	Min      float64
	Max      float64
	Currency string
}

func (f *SalaryFilter) Match(salary *struct {
	Min      float64
	Max      float64
	Currency string
}) bool {
	if salary == nil {
		return true
	}

	jobMin, jobMax := salary.Min, salary.Max
	jobCurrency := strings.ToUpper(strings.TrimSpace(salary.Currency))

	// Currency mismatch
	filterCurrency := strings.ToUpper(strings.TrimSpace(f.Currency))
	if filterCurrency != "" && jobCurrency != "" && filterCurrency != jobCurrency {
		return false
	}

	// Job entirely below user minimum
	if f.Min > 0 && jobMax > 0 && jobMax < f.Min {
		return false
	}
	// Job entirely above user maximum
	if f.Max > 0 && jobMin > 0 && jobMin > f.Max {
		return false
	}
	return true
}

func (f *SalaryFilter) MatchSalary(s *SalaryInfo) bool {
	if s == nil {
		return true
	}
	jobCurrency := strings.ToUpper(strings.TrimSpace(s.Currency))
	filterCurrency := strings.ToUpper(strings.TrimSpace(f.Currency))
	if filterCurrency != "" && jobCurrency != "" && filterCurrency != jobCurrency {
		return false
	}
	if f.Min > 0 && s.Max > 0 && s.Max < f.Min {
		return false
	}
	if f.Max > 0 && s.Min > 0 && s.Min > f.Max {
		return false
	}
	return true
}

type SalaryInfo struct {
	Min      float64
	Max      float64
	Currency string
}

func BuildSalaryFilter(cfg *SalaryFilterConfig) *SalaryFilter {
	f := &SalaryFilter{
		Currency: strings.ToUpper(strings.TrimSpace(cfg.Currency)),
	}
	if cfg != nil {
		f.Min = cfg.Min
		f.Max = cfg.Max
	}
	return f
}

func normalizeKeywords(arr []string) []string {
	var result []string
	for _, k := range arr {
		k = strings.TrimSpace(strings.ToLower(k))
		if k != "" {
			result = append(result, k)
		}
	}
	return result
}
