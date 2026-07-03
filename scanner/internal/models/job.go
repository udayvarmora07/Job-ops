package models

type Job struct {
	Title       string `json:"title"`
	URL         string `json:"url"`
	Company     string `json:"company"`
	Location    string `json:"location,omitempty"`
	PostedAt    int64  `json:"postedAt,omitempty"`
	Description string `json:"description,omitempty"`
	Salary      *Salary `json:"salary,omitempty"`
}

type Salary struct {
	Min      float64 `json:"min"`
	Max      float64 `json:"max"`
	Currency string  `json:"currency"`
}
