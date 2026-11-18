# Nur während der Untersuchung im HTTP-Kontext aktivieren.
error_log /var/log/nginx/error.log info;

map $status $verbindung_diagnostizieren {
    default 0;
    400 1;
    501 1;
}

map $verbindung_diagnostizieren $security_standard {
    0 1;
    1 0;
}

log_format security_diagnose escape=json '{"log_type":"security","timestamp":"$time_iso8601",'
    '"client_ip":"$remote_addr","method":"$request_method","path":"$uri",'
    '"status":$status,"request_id":"$request_id","peer_ip":"$realip_remote_addr",'
    '"proxy_client_ip":"$proxy_protocol_addr","server_port":"$server_port",'
    '"pid":"$pid","connection":"$connection","request_length":$request_length}';
access_log /dev/stderr security if=$security_standard;
access_log /dev/stderr security_diagnose if=$verbindung_diagnostizieren;
