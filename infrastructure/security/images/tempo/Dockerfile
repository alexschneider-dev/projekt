# Sicherheitsbuild mit festgelegten Quellen und aktualisierten Laufzeitabhängigkeiten.
FROM --platform=$BUILDPLATFORM golang:1.27.4-alpine@sha256:70bd7ddea8b6cbe5d6943cde279d6b67feb10cc924fb9100d1d8757c1575b280 AS build
ADD --checksum=sha256:9a4ecf9f2d9c245704965b2844a35d6769e0ed97fdfc3d44663f90d307c5d466 https://codeload.github.com/grafana/tempo/tar.gz/refs/tags/v2.10.10 /tmp/source.tar.gz
WORKDIR /src
RUN tar -xzf /tmp/source.tar.gz --strip-components=1 && rm /tmp/source.tar.gz
ENV CGO_ENABLED=0 GOTOOLCHAIN=local GOMAXPROCS=2
RUN --mount=type=cache,target=/go/pkg/mod \
    go get github.com/go-jose/go-jose/v4@v4.1.6 \
      go.opentelemetry.io/otel/sdk@v1.47.0 go.opentelemetry.io/otel/trace@v1.47.0 \
      go.opentelemetry.io/otel/sdk/log@v1.47.0 \
      golang.org/x/crypto@v0.58.1-0.20261009181718-2f1f834330b2 \
      golang.org/x/net@v0.62.0 golang.org/x/text@v0.43.0 && go mod tidy
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    go test -p 2 -mod=readonly ./tempodb/backend/local ./pkg/api
ARG TARGETOS
ARG TARGETARCH
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    GOOS=$TARGETOS GOARCH=$TARGETARCH go build -p 2 -mod=readonly \
      -ldflags='-s -w -X main.Version=2.10.10-projekt.2' -o /out/tempo ./cmd/tempo

FROM grafana/tempo:2.10.10@sha256:12b0820f13ffa10ce956b6e9acc3b03f3cffded99109be6cc09d106fe56e5d38 AS upstream
FROM gcr.io/distroless/static-debian13@sha256:448810357cc8e67b7208988abdba0f5ec3d3aebee0a5b13eb624979792cffc0f
COPY --from=upstream /etc/passwd /etc/passwd
COPY --from=upstream /etc/group /etc/group
COPY --from=upstream --chown=10001:10001 /var/tempo /var/tempo
COPY --from=build /out/tempo /tempo
USER 10001:10001
ENTRYPOINT ["/tempo"]
