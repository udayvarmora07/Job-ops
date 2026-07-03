package provider

import "github.com/santifer/jobops/scanner/internal/models"

var registry = make(map[string]Provider)

func Register(p Provider) {
	registry[p.ID()] = p
}

func Get(id string) (Provider, bool) {
	p, ok := registry[id]
	return p, ok
}

func All() []Provider {
	result := make([]Provider, 0, len(registry))
	for _, p := range registry {
		result = append(result, p)
	}
	return result
}

func Detect(entry *models.PortalEntry) (Provider, bool) {
	if entry.Provider != "" {
		p, ok := registry[entry.Provider]
		return p, ok
	}
	for _, p := range All() {
		if p.Detect(entry) {
			return p, true
		}
	}
	return nil, false
}
