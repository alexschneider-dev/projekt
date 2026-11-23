FROM alpine:3.24

# Sicherheitskorrekturen ab Nginx 1.30.7 und aktuelle Systempakete einspielen.
RUN apk upgrade --no-cache \
  && apk add --no-cache 'nginx>=1.30.7' nginx-mod-http-brotli \
  && command -v nginx \
  && nginx -v \
  && mkdir -p /etc/nginx/conf.d /var/www/certbot /run/nginx \
  && rm -f /etc/nginx/conf.d/* \
  && ln -sf /dev/stdout /var/log/nginx/access.log \
  && ln -sf /dev/stderr /var/log/nginx/error.log

COPY nginx.conf /etc/nginx/nginx.conf
COPY security-standard.inc security-diagnose.inc /etc/nginx/
RUN ln -s /etc/nginx/security-standard.inc /etc/nginx/security-aktiv.inc
COPY default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80 443

CMD ["/usr/sbin/nginx", "-g", "daemon off;"]
COPY marketplace.inc stellensuche.inc /etc/nginx/

COPY landing /usr/share/nginx/landing

COPY grafana.inc /etc/nginx/grafana.inc
