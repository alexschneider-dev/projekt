# Loki 3.6.18 mit korrigierter Logstufe für Abbrüche und festem Quellstand.
FROM golang:1.26.9 AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 && rm -rf /var/lib/apt/lists/*
ADD --checksum=sha256:e657cb21645f93db790dee66122a61779a3db30aea049300d04db6894e6d4789 https://codeload.github.com/grafana/loki/tar.gz/c969f5cf4b4ca6073d29e0a74b236f4d05d7b79a /tmp/loki.tar.gz
WORKDIR /src/loki
RUN tar -xzf /tmp/loki.tar.gz --strip-components=1 && rm /tmp/loki.tar.gz
COPY . /patch
RUN python3 /patch/apply-patch.py /src/loki
RUN gofmt -w pkg/util/log/chunk_fetch_log*.go pkg/storage/chunk/client/util/parallel_chunk_fetch.go pkg/storage/chunk/client/util/parallel_cancellation_test.go
RUN --mount=type=cache,target=/root/.cache/go-build CGO_ENABLED=0 go test -p 2 -mod=vendor ./pkg/util/log ./pkg/storage/chunk/client/util ./pkg/storage/chunk/fetcher
RUN --mount=type=cache,target=/root/.cache/go-build CGO_ENABLED=0 go build -p 2 -mod=vendor -tags netgo -ldflags='-s -w -X github.com/grafana/loki/v3/pkg/util/build.Version=3.6.18-projekt.1 -X github.com/grafana/loki/v3/pkg/util/build.Revision=c969f5cf4b4ca6073d29e0a74b236f4d05d7b79a' -o /out/loki ./cmd/loki
FROM grafana/loki:3.6.18
COPY --from=build /out/loki /usr/bin/loki
