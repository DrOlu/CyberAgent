//go:build unix

package agent

import (
	"os"
	"syscall"
	"testing"
)

// writeTestExecutable writes content to path with exec perms while holding
// syscall.ForkLock.RLock, so no concurrent t.Parallel() sibling can fork
// between our OpenFile and Close. Without this, Linux ETXTBSY fires when
// the sibling's fork child inherits our still-open write fd and the
// subsequent exec of the file sees "text file busy" (seen on CI as
// TestKimiBackendInvokesACPSubcommand: fork/exec ... text file busy).
func writeTestExecutable(tb testing.TB, path string, content []byte) {
	tb.Helper()
	syscall.ForkLock.RLock()
	defer syscall.ForkLock.RUnlock()
	// Write to a sibling temp file and rename into place. Exec'ing a file
	// written in place can hit ETXTBSY ("text file busy") on overlayfs CI
	// runners, the same flake already fixed inline in the zcode, muse and
	// dim fake helpers; a same-directory rename is atomic and avoids it.
	tmp := path + ".tmp"
	f, err := os.OpenFile(tmp, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o755)
	if err != nil {
		tb.Fatalf("write test executable %s: open: %v", path, err)
	}
	if _, err := f.Write(content); err != nil {
		_ = f.Close()
		tb.Fatalf("write test executable %s: write: %v", path, err)
	}
	if err := f.Close(); err != nil {
		tb.Fatalf("write test executable %s: close: %v", path, err)
	}
	if err := os.Rename(tmp, path); err != nil {
		tb.Fatalf("write test executable %s: rename: %v", path, err)
	}
}
