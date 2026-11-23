# Sicherheitsbuild mit festgelegten Quellen und aktualisierten Laufzeitabhängigkeiten.
FROM --platform=$BUILDPLATFORM golang:1.27.4-alpine@sha256:70bd7ddea8b6cbe5d6943cde279d6b67feb10cc924fb9100d1d8757c1575b280 AS source
ADD --checksum=sha256:2709a3bd43f9d15e0cecfc33ab473d011e2a69ab29265b91398cc1b8561403c0 https://codeload.github.com/prometheus/prometheus/tar.gz/refs/tags/v3.16.0 /tmp/source.tar.gz
WORKDIR /src
RUN tar -xzf /tmp/source.tar.gz --strip-components=1 && rm /tmp/source.tar.gz

FROM --platform=$BUILDPLATFORM node:22-alpine3.24@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a AS ui
RUN apk add --no-cache bash && npm install -g pnpm@11.25.0
WORKDIR /src/web/ui
COPY --from=source /src/web/ui/ ./
RUN pnpm install --frozen-lockfile && cd react-app && pnpm install --frozen-lockfile
RUN CI= pnpm run build

FROM source AS build
RUN apk add --no-cache bash gzip
ENV CGO_ENABLED=0 GOTOOLCHAIN=local GOWORK=off GOMAXPROCS=2
RUN --mount=type=cache,target=/go/pkg/mod \
    go get golang.org/x/crypto@v0.58.1-0.20261009181718-2f1f834330b2 \
           golang.org/x/net@v0.62.0 golang.org/x/text@v0.43.0 && go mod tidy
COPY --from=ui /src/web/ui/static /src/web/ui/static
RUN scripts/compress_assets.sh
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    go test -p 2 -mod=readonly ./model/rulefmt ./config
ARG TARGETOS
ARG TARGETARCH
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    GOOS=$TARGETOS GOARCH=$TARGETARCH go build -p 2 -mod=readonly -tags netgo,builtinassets \
      -ldflags='-s -w -X github.com/prometheus/common/version.Version=3.16.0-projekt.1' \
      -o /out/ ./cmd/prometheus ./cmd/promtool

FROM prom/prometheus:v3.16.0@sha256:e04987641b57704f408e31f6373ba4138ecf27cb4a165d24aabb6c38fddd0f06
COPY --from=build /out/prometheus /bin/prometheus
COPY --from=build /out/promtool /bin/promtool
