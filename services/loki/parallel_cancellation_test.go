package util

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/go-kit/log"
	"github.com/grafana/loki/v3/pkg/storage/chunk"
	util_log "github.com/grafana/loki/v3/pkg/util/log"
)


func TestParallelFetchCancellationLogAndReturn(t *testing.T) {
	for _, canceledError := range []bool{
		true,
		false,
	} {
		ctx, cancel := context.WithCancel(context.Background())
		var output bytes.Buffer
		previous := util_log.Logger
		util_log.Logger = log.NewLogfmtLogger(&output)
		_, err := GetParallelChunks(
			ctx,
			1,
			[]chunk.Chunk{{}},
			func(
				context.Context,
				*chunk.DecodeContext,
				chunk.Chunk,
			) (chunk.Chunk, error) {
				cancel()
				if canceledError {
					return chunk.Chunk{}, fmt.Errorf(
						"S3 GetObject: %w",
						context.Canceled,
					)
				}
				return chunk.Chunk{}, errors.New("AccessDenied")
			},
		)
		util_log.Logger = previous
		cancel()
		want := "level=error"
		if canceledError {
			want = "level=debug"
			if !errors.Is(
				err,
				context.Canceled,
			) {
				t.Fatal(err)
			}
		}
		if err == nil || !strings.Contains(
			output.String(),
			want,
		) {
			t.Fatal(
				err,
				output.String(),
			)
		}
	}
}
