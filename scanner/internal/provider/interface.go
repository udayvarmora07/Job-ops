package provider

import "github.com/santifer/jobops/scanner/internal/models"

type Provider interface {
	ID() string
	Detect(entry *models.PortalEntry) bool
	Fetch(entry *models.PortalEntry, ctx *Context) ([]models.Job, error)
}
