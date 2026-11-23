# Sicherheitsbuild mit festgelegten Quellen und aktualisierten Laufzeitabhängigkeiten.
ARG RUNTIME_IMAGE=scratch
FROM --platform=$BUILDPLATFORM golang:1.27.4-alpine@sha256:70bd7ddea8b6cbe5d6943cde279d6b67feb10cc924fb9100d1d8757c1575b280 AS build
ARG SOURCE_URL
ARG SOURCE_SHA256
ADD --checksum=sha256:${SOURCE_SHA256} ${SOURCE_URL} /tmp/source.tar.gz
WORKDIR /src
RUN tar -xzf /tmp/source.tar.gz --strip-components=1 && rm /tmp/source.tar.gz
ENV CGO_ENABLED=0 GOTOOLCHAIN=local GOMAXPROCS=2
RUN --mount=type=cache,target=/go/pkg/mod \
    go get golang.org/x/crypto@v0.58.1-0.20261009181718-2f1f834330b2 \
           golang.org/x/net@v0.62.0 golang.org/x/text@v0.43.0 && go mod tidy
RUN if [ -f collector/fixtures/sys.ttar ]; then \
      apk add --no-cache bash coreutils sed && \
      ./ttar -C collector/fixtures -x -f collector/fixtures/sys.ttar && \
      ./ttar -C collector/fixtures -x -f collector/fixtures/udev.ttar; \
    fi
ARG TEST_PATTERN=.
ARG TEST_FILTER=.
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    go test -p 2 -mod=readonly -run "$TEST_FILTER" "$TEST_PATTERN"
ARG TARGETOS
ARG TARGETARCH
ARG MAIN_PACKAGE=.
ARG RELEASE_VERSION
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    GOOS=$TARGETOS GOARCH=$TARGETARCH go build -p 2 -mod=readonly \
      -ldflags="-s -w -X github.com/prometheus/common/version.Version=$RELEASE_VERSION -X main.BuildVersion=$RELEASE_VERSION" \
      -o /out/exporter "$MAIN_PACKAGE"
FROM ${RUNTIME_IMAGE}
ARG BINARY_PATH
COPY --from=build /out/exporter ${BINARY_PATH}
