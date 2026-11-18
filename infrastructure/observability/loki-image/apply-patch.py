"""Nur die zwei geprüften Loki-Logstellen ändern; abweichenden Quellstand ablehnen."""

from pathlib import Path
import shutil
import sys


from errors.messages import ERRORS


source = Path(sys.argv[1])
here = Path(__file__).resolve().parent
changes = {
    "pkg/storage/chunk/client/util/parallel_chunk_fetch.go": [
        (
            '\t"github.com/go-kit/log/level"\n',
            "",
        ),
        (
            'level.Error(util_log.Logger).Log("msg", "error fetching chunks", "err", lastErr)',
            'util_log.LogChunkFetchError(ctx, util_log.Logger, "error fetching chunks", lastErr)',
        ),
    ],
    "pkg/storage/chunk/fetcher/fetcher.go": [
        (
            'level.Error(log).Log("msg", "failed downloading chunks", "err", err)',
            'util_log.LogChunkFetchError(ctx, log, "failed downloading chunks", err)',
        ),
    ],
}
for name, replacements in changes.items():
    path = source / name
    content = path.read_text()
    for old, new in replacements:
        assert content.count(old) == 1, ERRORS["SOURCE"].format(
            name=name,
            old=old,
        )
        content = content.replace(
            old,
            new,
        )
    path.write_text(content)
for name in [
    "chunk_fetch_log.go",
    "chunk_fetch_log_test.go",
]:
    target = source / "pkg/util/log" / name
    assert not target.exists(), ERRORS["EXISTS"].format(name=name)
    shutil.copyfile(
        here / name,
        target,
    )
shutil.copyfile(
    here / "parallel_cancellation_test.go",
    source / "pkg/storage/chunk/client/util/parallel_cancellation_test.go",
)
