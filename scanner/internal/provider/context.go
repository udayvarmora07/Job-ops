package provider

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	defaultTimeout = 10 * time.Second
	defaultUA      = "Mozilla/5.0 (compatible; jobops/1.3)"
)

type RequestOptions struct {
	Timeout  time.Duration
	Headers  map[string]string
	Method   string
	Body     string
	Redirect string // "follow", "error", "manual"
}

type Context struct {
	client  *http.Client
	verbose bool
}

func NewContext(timeout time.Duration) *Context {
	if timeout == 0 {
		timeout = defaultTimeout
	}
	return &Context{
		client: &http.Client{Timeout: timeout},
	}
}

func (c *Context) SetVerbose(v bool) {
	c.verbose = v
}

func (c *Context) doRequest(url string, opts *RequestOptions) (*http.Response, error) {
	if opts == nil {
		opts = &RequestOptions{}
	}
	method := opts.Method
	if method == "" {
		method = "GET"
	}

	var body io.Reader
	if opts.Body != "" {
		body = strings.NewReader(opts.Body)
	}

	req, err := http.NewRequest(method, url, body)
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}
	req.Header.Set("User-Agent", defaultUA)
	for k, v := range opts.Headers {
		req.Header.Set(k, v)
	}

	client := c.client
	if opts.Timeout > 0 {
		client = &http.Client{Timeout: opts.Timeout}
	}

	if opts.Redirect == "error" || opts.Redirect == "manual" {
		client.CheckRedirect = func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		}
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	if resp.StatusCode >= 400 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		snippet := strings.TrimSpace(strings.ReplaceAll(string(bodyBytes), "\n", " "))
		if len(snippet) > 300 {
			snippet = snippet[:300]
		}
		if snippet != "" {
			return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, snippet)
		}
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	return resp, nil
}

func (c *Context) FetchJSON(url string, opts *RequestOptions) ([]byte, error) {
	if opts == nil {
		opts = &RequestOptions{}
	}
	if opts.Headers == nil {
		opts.Headers = make(map[string]string)
	}
	if _, ok := opts.Headers["Accept"]; !ok {
		opts.Headers["Accept"] = "application/json"
	}

	resp, err := c.doRequest(url, opts)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading response body: %w", err)
	}
	return body, nil
}

func (c *Context) FetchText(url string, opts *RequestOptions) (string, error) {
	if opts == nil {
		opts = &RequestOptions{}
	}
	if opts.Headers == nil {
		opts.Headers = make(map[string]string)
	}
	opts.Headers["Accept"] = "text/plain"

	resp, err := c.doRequest(url, opts)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("reading response body: %w", err)
	}
	return string(body), nil
}
