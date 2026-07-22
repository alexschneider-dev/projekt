FROM alpine:3.22

RUN apk add --no-cache nginx nginx-mod-http-brotli \
  && command -v nginx \
  && nginx -v \
  && mkdir -p /etc/nginx/conf.d /var/www/certbot /run/nginx \
  && rm -f /etc/nginx/conf.d/* \
  && ln -sf /dev/stdout /var/log/nginx/access.log \
  && ln -sf /dev/stderr /var/log/nginx/error.log

COPY default.conf /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80 443

CMD ["/usr/sbin/nginx", "-g", "daemon off;"]