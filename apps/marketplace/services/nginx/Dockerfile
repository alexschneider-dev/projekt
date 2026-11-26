FROM nginx:1.30.8-alpine

# Aktuelle Sicherheitskorrekturen der Systempakete einspielen.
RUN apk upgrade --no-cache

COPY default.conf /etc/nginx/conf.d/default.conf
