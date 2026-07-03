package dedup

import (
	"os"
	"testing"
)

func TestLoadScanHistory(t *testing.T) {
	content := "url\tfirst_seen\tportal\ttitle\tcompany\tstatus\tlocation\n" +
		"https://example.com/job1\t2026-07-01\tgreenhouse\tEngineer\tAcme\tadded\tRemote\n" +
		"https://example.com/job2\t2026-07-02\tlever\tSRE\tBeta\tadded\tBangalore\n"

	tmpfile, err := os.CreateTemp(t.TempDir(), "scan-history-*.tsv")
	if err != nil {
		t.Fatal(err)
	}
	defer tmpfile.Close()

	if _, err := tmpfile.WriteString(content); err != nil {
		t.Fatal(err)
	}

	sh, err := LoadScanHistory(tmpfile.Name())
	if err != nil {
		t.Fatal(err)
	}

	if !sh.Seen("https://example.com/job1") {
		t.Error("expected job1 to be seen")
	}
	if !sh.Seen("https://example.com/job2") {
		t.Error("expected job2 to be seen")
	}
	if sh.Seen("https://example.com/job3") {
		t.Error("expected job3 to not be seen")
	}

	sh.Add("https://example.com/job3")
	if !sh.Seen("https://example.com/job3") {
		t.Error("expected job3 to be seen after Add")
	}
}

func TestLoadScanHistoryNonExistent(t *testing.T) {
	sh, err := LoadScanHistory("/nonexistent/path.tsv")
	if err != nil {
		t.Fatal(err)
	}
	if sh.Seen("anything") {
		t.Error("expected empty history to not contain anything")
	}
}
