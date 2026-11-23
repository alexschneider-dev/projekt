# Sicherheitsbuild mit festgelegten Quellen und aktualisierten Laufzeitabhängigkeiten.
FROM python:3.13-alpine3.24@sha256:9ef1a599f863231c3d91e941389bfdc4a2d6070557243d54df1a4e57015b960e
RUN apk upgrade --no-cache \
  && rm -rf /usr/local/lib/python3.13/site-packages/* \
    /usr/local/lib/python3.13/ensurepip /usr/local/bin/pip*
RUN python -c 'import ssl, sqlite3, tarfile, http.server, socket, json; assert ssl.create_default_context().cert_store_stats()["x509_ca"] > 0'
