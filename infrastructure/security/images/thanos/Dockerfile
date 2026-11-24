# Sicherheitsbuild mit festgelegten Quellen und aktualisierten Laufzeitabhängigkeiten.
FROM --platform=$BUILDPLATFORM prom/prometheus:v2.54.1@sha256:f6639335d34a77d9d9db382b92eeb7fc00934be8eae81dbc03b31cfe90411a94 AS test-prometheus
FROM --platform=$BUILDPLATFORM golang:1.27.4-alpine@sha256:70bd7ddea8b6cbe5d6943cde279d6b67feb10cc924fb9100d1d8757c1575b280 AS source
RUN apk add --no-cache patch
ENV CGO_ENABLED=0 GOTOOLCHAIN=local GOMAXPROCS=2
COPY --from=test-prometheus /bin/prometheus /usr/local/bin/prometheus-v0.54.1
ENV THANOS_TEST_OBJSTORE_SKIP=GCS,S3,AZURE,SWIFT,COS,ALIYUNOSS,BOS,OCI,OBS
WORKDIR /tmp
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download github.com/thanos-io/promql-engine@v0.0.0-20261026092651-89d6517ed91a \
      github.com/prometheus-community/prom-label-proxy@v0.16.2 && \
    mkdir -p /src/compat && \
    cp -R /go/pkg/mod/github.com/thanos-io/promql-engine@v0.0.0-20261026092651-89d6517ed91a /src/compat/promql-engine && \
    cp -R /go/pkg/mod/github.com/prometheus-community/prom-label-proxy@v0.16.2 /src/compat/prom-label-proxy && \
    chmod -R u+w /src/compat
ADD --checksum=sha256:61a91cccc4fb400603ac729f7d9116f797f252eec7613eefa935ac6e8f976609 https://codeload.github.com/thanos-io/thanos/tar.gz/refs/tags/v0.42.5 /tmp/source.tar.gz
WORKDIR /src
RUN tar -xzf /tmp/source.tar.gz --strip-components=1 && rm /tmp/source.tar.gz
COPY security.patch dependencies.patch acceptance-test.patch /tmp/
RUN patch -p1 < /tmp/security.patch && patch -p1 < /tmp/dependencies.patch \
    && patch -p1 < /tmp/acceptance-test.patch

FROM source AS build
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    go test -p 2 -mod=readonly -tags=slicelabels \
      ./pkg/extpromql ./pkg/alert ./pkg/compact/downsample ./pkg/dedup \
      ./pkg/store ./pkg/rules ./pkg/compactv2 ./internal/cortex/querier/series \
      ./pkg/query ./pkg/api/query ./pkg/block ./pkg/store/labelpb
ARG TARGETOS
ARG TARGETARCH
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    GOOS=$TARGETOS GOARCH=$TARGETARCH go build -p 2 -mod=readonly -tags=netgo,slicelabels \
      -ldflags='-s -w -X github.com/prometheus/common/version.Version=0.42.5-projekt.1' \
      -o /out/thanos ./cmd/thanos

FROM quay.io/thanos/thanos:v0.42.5@sha256:0a546b98a8dd47735456ab389983675ee363d68127e334937a9fceeea10da5e7
COPY --from=build --chown=1001:1001 /out/thanos /bin/thanos
