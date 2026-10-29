package log

import (
	"context"
	"errors"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
)


// LogChunkFetchError hält echte Speicherfehler auch bei gleichzeitigem Abbruch sichtbar.
// Ein abgebrochener Kontext allein genügt nicht.
func LogChunkFetchError(
	ctx context.Context,
	logger log.Logger,
	message string,
	err error,
) {
	writer := level.Error(logger)
	if errors.Is(
		ctx.Err(),
		context.Canceled,
	) && errors.Is(
		err,
		context.Canceled,
	) {
		writer = level.Debug(logger)
	}
	_ = writer.Log(
		"msg",
		message,
		"err",
		err,
	)
}
