#!/usr/bin/env bash
set -euo pipefail
umask 077
cd -- "$(dirname -- "$0")"
[[ $(pwd -P) == /opt/nobi-photos-cloud/accounts && $(id -u) == 0 ]] || exit 1
site=/etc/nginx/sites-available/nobi-photos-accounts
link=/etc/nginx/sites-enabled/nobi-photos-accounts
if [[ -e "$site" || -e "$link" ]]; then
  [[ -L "$link" && $(readlink "$link") == "$site" ]] || exit 1
  cmp -s "$site" nginx-http.conf || { echo 'Existing site differs; refusing overwrite'; exit 1; }
else
  if grep -Rq 'server_name.*photos\.nobistudio\.com' /etc/nginx/sites-enabled; then
    echo 'Domain already owned by another server configuration'; exit 1
  fi
  install -d -m 755 /var/www/nobi-photos-acme
  install -m 644 nginx-http.conf "$site"
  ln -s "$site" "$link"
  nginx -t
  systemctl reload nginx
fi
certbot certonly --webroot -w /var/www/nobi-photos-acme --cert-name photos.nobistudio.com -d photos.nobistudio.com --non-interactive --agree-tos --register-unsafely-without-email --no-eff-email
install -m 644 nginx-https.conf "$site"
nginx -t
systemctl reload nginx
hook=/etc/letsencrypt/renewal-hooks/deploy/nobi-photos-reload
[[ ! -e "$hook" ]] || exit 1
install -d -m 755 /etc/letsencrypt/renewal-hooks/deploy
cat > "$hook" <<'SH'
#!/bin/sh
case " ${RENEWED_DOMAINS:-} " in
  *" photos.nobistudio.com "*) nginx -t && systemctl reload nginx ;;
esac
SH
chmod 700 "$hook"
echo 'Dedicated Photos HTTPS site and domain-specific renewal reload hook configured.'
