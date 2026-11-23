FROM nginx:1.30.7-alpine

# Aktuelle Sicherheitskorrekturen der Systempakete einspielen.
RUN apk upgrade --no-cache

COPY default.conf /etc/nginx/conf.d/default.conf
