location = /marketplace {
    set $marketplace_backend http://marketplace-haproxy:8080;
    proxy_pass $marketplace_backend$request_uri;
    proxy_http_version 1.1;
    proxy_set_header Host $http_host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header Cookie $http_cookie;
    proxy_set_header Authorization $http_authorization;
    proxy_cache off;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_buffering off;
    proxy_read_timeout 1h;
}

# Eigene Anwendungsrouten einschließlich Assets und Authentifizierung.
location ^~ /marketplace/ {
    set $marketplace_backend http://marketplace-haproxy:8080;
    proxy_pass $marketplace_backend$request_uri;
    proxy_http_version 1.1;
    proxy_set_header Host $http_host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header Cookie $http_cookie;
    proxy_set_header Authorization $http_authorization;
    proxy_cache off;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_buffering off;
    proxy_read_timeout 1h;
}
