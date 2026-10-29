package log

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/go-kit/log"
)


func TestChunkFetchCancellationLogging(t *testing.T) {
	canceled, cancel := context.WithCancel(context.Background())
	cancel()
	deadline, stop := context.WithDeadline(
		context.Background(),
		time.Now().Add(-time.Second),
	)
	defer stop()
	for _, tc := range []struct {
		name string
		ctx context.Context
		err error
		level string
	}{
		{
			"Abgebrochener Download",
			canceled,
			fmt.Errorf(
				"S3 GetObject: %w",
				context.Canceled,
			),
			"debug",
		},
		{
			"Berechtigungsfehler gleichzeitig mit Abbruch",
			canceled,
			errors.New("AccessDenied: status 403"),
			"error",
		},
		{
			"Fehlendes Objekt",
			canceled,
			errors.New("NoSuchKey: status 404"),
			"error",
		},
		{
			"Netzwerkfehler",
			canceled,
			errors.New("connection reset by peer"),
			"error",
		},
		{
			"Zeitüberschreitung",
			deadline,
			context.DeadlineExceeded,
			"error",
		},
		{
			"Unabhängiger Abbruch",
			context.Background(),
			context.Canceled,
			"error",
		},
		{
			"Fehlertext allein genügt nicht",
			canceled,
			errors.New("context canceled"),
			"error",
		},
	} {
		t.Run(
			tc.name,
			func(t *testing.T) {
				var out bytes.Buffer
				LogChunkFetchError(
					tc.ctx,
					log.NewLogfmtLogger(&out),
					"failed downloading chunks",
					tc.err,
				)
				if !strings.Contains(
					out.String(),
					"level="+tc.level+" ",
				) || !strings.Contains(
					out.String(),
					"err=",
				) {
					t.Fatal(out.String())
				}
			},
		)
	}
}
