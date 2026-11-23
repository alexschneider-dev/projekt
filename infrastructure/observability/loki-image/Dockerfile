# Loki 3.6.22 mit korrigierter Logstufe für Abbrüche und festem Quellstand.
FROM --platform=$BUILDPLATFORM golang:1.26.11 AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 && rm -rf /var/lib/apt/lists/*
ADD --checksum=sha256:d96e02c36122b0d9f8dce0deddbe1ecac12746bf1b34da141a9f5301be307af6 https://codeload.github.com/grafana/loki/tar.gz/38e4020516b25119f795a8a5f55e06ccd9c9d1fc /tmp/loki.tar.gz
WORKDIR /src/loki
RUN tar -xzf /tmp/loki.tar.gz --strip-components=1 && rm /tmp/loki.tar.gz
COPY . /patch
RUN python3 /patch/apply-patch.py /src/loki
RUN gofmt -w pkg/util/log/chunk_fetch_log*.go pkg/storage/chunk/client/util/parallel_chunk_fetch.go pkg/storage/chunk/client/util/parallel_cancellation_test.go
RUN --mount=type=cache,target=/root/.cache/go-build CGO_ENABLED=0 go test -p 2 -mod=vendor ./pkg/util/log ./pkg/storage/chunk/client/util ./pkg/storage/chunk/fetcher
ARG TARGETOS
ARG TARGETARCH
RUN --mount=type=cache,target=/root/.cache/go-build CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -p 2 -mod=vendor -tags netgo -ldflags='-s -w -X github.com/grafana/loki/v3/pkg/util/build.Version=3.6.22-projekt.1 -X github.com/grafana/loki/v3/pkg/util/build.Revision=38e4020516b25119f795a8a5f55e06ccd9c9d1fc' -o /out/loki ./cmd/loki
FROM grafana/loki:3.6.22
COPY --from=build /out/loki /usr/bin/loki
