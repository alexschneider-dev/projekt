location = /stellensuche {
    limit_req zone=mylimit burst=100 nodelay;
    limit_req_status 429;
    proxy_pass http://nextjs_upstream;
    proxy_http_version 1.1;
    proxy_set_header Host $http_host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header Cookie $http_cookie;
    proxy_set_header Authorization $http_authorization;
    proxy_cache off;
}


# Eigene Anwendungsrouten einschließlich Assets und Authentifizierung.
location ^~ /stellensuche/ {
    limit_req zone=mylimit burst=100 nodelay;
    limit_req_status 429;
    proxy_pass http://nextjs_upstream;
    proxy_http_version 1.1;
    proxy_set_header Host $http_host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header Cookie $http_cookie;
    proxy_set_header Authorization $http_authorization;
    proxy_cache off;
}
