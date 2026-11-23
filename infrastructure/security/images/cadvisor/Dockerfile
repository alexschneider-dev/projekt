# Sicherheitsbuild mit festgelegten Quellen und aktualisierten Laufzeitabhängigkeiten.
FROM golang:1.27.4-alpine@sha256:70bd7ddea8b6cbe5d6943cde279d6b67feb10cc924fb9100d1d8757c1575b280 AS toolchain
FROM ghcr.io/google/cadvisor:0.61.1@sha256:4929b70e82079d001d0028b85d6a4dd25ad4666b719455c9542b983489963916 AS build
USER root
COPY --from=toolchain /usr/local/go /usr/local/go
ENV PATH=/usr/local/go/bin:$PATH GOTOOLCHAIN=local GOMAXPROCS=2 CGO_ENABLED=1
RUN apk upgrade --no-cache && apk add --no-cache bash build-base linux-headers git
ADD --checksum=sha256:5da5f8872bde14b3634c9688d980f68bda28b510268723cc12973eedbab9fecc https://sourceforge.net/projects/perfmon2/files/libpfm4/libpfm-4.11.0.tar.gz/download /tmp/libpfm.tar.gz
RUN tar -xzf /tmp/libpfm.tar.gz -C /tmp \
    && make -C /tmp/libpfm-4.11.0 -j2 DIRS='lib tests include' \
    && make -C /tmp/libpfm-4.11.0 DIRS='lib include' install
ADD --checksum=sha256:fbb23e259c3939dcf7ed9aaff2bdc217356f4aaf578541d2d46fbc12a9789ce2 https://codeload.github.com/google/cadvisor/tar.gz/refs/tags/v0.61.1 /tmp/source.tar.gz
WORKDIR /src
RUN tar -xzf /tmp/source.tar.gz --strip-components=1
WORKDIR /src/cmd
RUN --mount=type=cache,target=/root/go/pkg/mod \
    go get golang.org/x/crypto@v0.58.1-0.20261009181718-2f1f834330b2 \
      golang.org/x/net@v0.62.0 golang.org/x/text@v0.43.0 \
      github.com/klauspost/compress@v1.18.7 go.opentelemetry.io/otel/trace@v1.47.0 \
      google.golang.org/grpc@v1.83.2 && go mod tidy
RUN --mount=type=cache,target=/root/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    go test -p 2 -mod=readonly -tags libpfm,netgo ./...
RUN --mount=type=cache,target=/root/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    go build -p 2 -mod=readonly -tags libpfm,netgo \
      -ldflags='-s -w -X github.com/google/cadvisor/lib/version.Version=0.61.1-projekt.1' \
      -o /out/cadvisor .

FROM ghcr.io/google/cadvisor:0.61.1@sha256:4929b70e82079d001d0028b85d6a4dd25ad4666b719455c9542b983489963916
RUN apk upgrade --no-cache
COPY --from=build /out/cadvisor /usr/bin/cadvisor
COPY --from=build /usr/local/lib/libpfm.so* /usr/local/lib/
