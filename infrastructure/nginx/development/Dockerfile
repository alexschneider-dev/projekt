FROM alpine:3.24

# Dieselben Nginx-Pakete wie in Produktion verwenden.
RUN apk upgrade --no-cache \
  && apk add --no-cache 'nginx>=1.30.7' nginx-mod-http-brotli \
  && mkdir -p /etc/nginx/conf.d /run/nginx \
  && rm -f /etc/nginx/conf.d/* \
  && ln -sf /dev/stdout /var/log/nginx/access.log \
  && ln -sf /dev/stderr /var/log/nginx/error.log

COPY ./development/default.conf /etc/nginx/conf.d/
COPY ./development/nginx.conf /etc/nginx/nginx.conf
COPY ./development/fullchain.pem /etc/nginx/fullchain.pem
COPY ./development/privkey.pem /etc/nginx/privkey.pem

EXPOSE 80

CMD [ "nginx", "-g", "daemon off;" ]
COPY development/marketplace.inc development/stellensuche.inc /etc/nginx/

COPY landing /usr/share/nginx/landing

COPY grafana.inc /etc/nginx/grafana.inc
