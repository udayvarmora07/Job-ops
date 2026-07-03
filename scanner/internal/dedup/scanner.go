package dedup

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

type ScanHistory struct {
	urls map[string]bool
}

func LoadScanHistory(path string) (*ScanHistory, error) {
	sh := &ScanHistory{urls: make(map[string]bool)}
	f, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return sh, nil
		}
		return nil, fmt.Errorf("opening scan history: %w", err)
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "url\t") {
			continue
		}
		cols := strings.Split(line, "\t")
		if len(cols) >= 1 {
			sh.urls[cols[0]] = true
		}
	}
	return sh, scanner.Err()
}

func (s *ScanHistory) Seen(url string) bool {
	return s.urls[url]
}

func (s *ScanHistory) Add(url string) {
	s.urls[url] = true
}
