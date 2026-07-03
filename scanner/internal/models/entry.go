package models

type PortalEntry struct {
	Name       string `yaml:"name"`
	Enabled    bool   `yaml:"enabled"`
	CareersURL string `yaml:"careers_url"`
	Provider   string `yaml:"provider"`
	API        string `yaml:"api"`
	ScanMethod string `yaml:"scan_method"`
	Notes      string `yaml:"notes"`
	Extra      map[string]any `yaml:",inline"`
}

func (e *PortalEntry) Get(key string) (any, bool) {
	if e.Extra == nil {
		return nil, false
	}
	v, ok := e.Extra[key]
	return v, ok
}
