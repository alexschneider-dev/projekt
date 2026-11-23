# Sicherheitsbuild mit festgelegten Quellen und aktualisierten Laufzeitabhängigkeiten.
FROM haproxy:3.2-alpine@sha256:7816a9801a6846b912bc37e48529808e2fa87c3c47992441940f68e393ebcfeb
USER root
RUN apk upgrade --no-cache
USER haproxy
