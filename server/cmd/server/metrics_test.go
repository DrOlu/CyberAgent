package main

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/cyberagent.sh/multica/server/internal/analytics"
	"github.com/cyberagent.sh/multica/server/internal/events"
	"github.com/cyberagent.sh/multica/server/internal/realtime"
)

func TestMainRouterDoesNotExposePrometheusMetrics(t *testing.T) {
	router := NewRouter(nil, realtime.NewHub(), events.New(), analytics.NoopClient{}, nil)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("main API /metrics status = %d, want %d", rec.Code, http.StatusNotFound)
	}
}
