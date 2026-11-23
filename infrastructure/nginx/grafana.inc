    location = /_grafana_auth {
        internal;
        set $marketplace_auth_backend http://marketplace-haproxy:8080;
        proxy_pass $marketplace_auth_backend/marketplace/api/observability/auth;
        proxy_method GET;
        proxy_pass_request_headers off;
        proxy_pass_request_body off;
        proxy_set_header Content-Length "";
        proxy_set_header Cookie $http_cookie;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache off;
    }

    location = /grafana { return 302 /grafana/; }
    location ^~ /grafana/ {
        auth_request /_grafana_auth;
        auth_request_set $grafana_user $upstream_http_x_webauth_user;
        auth_request_set $grafana_role $upstream_http_x_webauth_role;
        error_page 401 = @grafana_login;
        set $grafana_backend http://observability_grafana:3000;
        proxy_pass $grafana_backend$request_uri;
        proxy_http_version 1.1;
        proxy_set_header X-Webauth-User $grafana_user;
        proxy_set_header X-Webauth-Role $grafana_role;
        proxy_set_header Authorization "";
        proxy_set_header Cookie "";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_cache off;

        # Frühe Browser-Abbrüche nicht an Dashboard-, Such- und Datenabfragen weitergeben.
        # Authentifizierung bleibt geerbt; andere APIs und Live behalten ihr Verhalten.
        # Große Antworten können beim späteren Schreiben trotzdem abbrechen.
        location ~ ^/grafana/(?:api/ds/query$|apis/dashboard\.grafana\.app/v0alpha1/namespaces/default/search$|d/|d-solo/|$) {
            set $grafana_backend http://observability_grafana:3000;
            proxy_pass $grafana_backend$request_uri;
            proxy_ignore_client_abort on;
            # Über dem Zeitlimit der Loki-Datenquelle (105 Sekunden).
            proxy_read_timeout 120s;
        }
    }
    location @grafana_login { return 302 /marketplace/login; }

