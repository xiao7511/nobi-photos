#!/usr/bin/env bash
set -euo pipefail
umask 077
cd -- "$(dirname -- "$0")"
[[ $(pwd -P) == /opt/nobi-photos-cloud/accounts && $(id -u) == 0 ]] || exit 1
[[ ! -e secrets && ! -e initialized ]] || { echo 'Existing account deployment: refusing overwrite'; exit 1; }
[[ $(docker inspect nobi-photos-cloud-db --format '{{index .Config.Labels "com.docker.compose.project"}}') == nobi-photos-cloud ]]
[[ $(docker inspect nobi-photos-cloud-db --format '{{.State.Health.Status}}') == healthy ]]
[[ $(docker exec nobi-photos-cloud-db psql -U supabase_admin -d nobi_photos_cloud -Atc "select count(*) from information_schema.schemata where schema_name='auth'") == 0 ]] || { echo 'Auth schema already exists; refusing migration'; exit 1; }
[[ -z $(docker ps -aq --filter name=^nobi-photos-accounts-) ]]
[[ -z $(ss -lntH '( sport = :15433 )') ]]
mkdir -m 700 secrets
python3 - <<'PY'
import base64,hashlib,hmac,json,secrets,time,os
from pathlib import Path
def enc(value): return base64.urlsafe_b64encode(value).decode().rstrip('=')
secret=secrets.token_hex(32)
def jwt(role):
    a=enc(json.dumps({'alg':'HS256','typ':'JWT'},separators=(',',':')).encode())
    b=enc(json.dumps({'role':role,'iss':'supabase','iat':int(time.time()),'exp':int(time.time())+5*365*86400},separators=(',',':')).encode())
    return a+'.'+b+'.'+enc(hmac.new(secret.encode(),(a+'.'+b).encode(),hashlib.sha256).digest())
password=secrets.token_hex(24)
anon=jwt('anon')
config={'publicAuthEnabled':False,'anonKey':anon,'serviceKey':jwt('service_role'),'stagingKey':secrets.token_hex(32),'origins':['https://photos.nobistudio.com','https://localhost','capacitor://localhost']}
Path('secrets/gateway.json').write_text(json.dumps(config))
os.chown('secrets/gateway.json',1000,1000); os.chmod('secrets/gateway.json',0o400)
Path('secrets/auth-password').write_text(password); os.chmod('secrets/auth-password',0o400)
values={
 'API_EXTERNAL_URL':'https://photos.nobistudio.com/auth/v1','GOTRUE_API_HOST':'0.0.0.0','GOTRUE_API_PORT':'9999',
 'GOTRUE_SITE_URL':'https://photos.nobistudio.com','GOTRUE_URI_ALLOW_LIST':'https://photos.nobistudio.com',
 'GOTRUE_DB_DRIVER':'postgres','GOTRUE_DB_DATABASE_URL':f'postgres://nobi_photos_auth:{password}@nobi-photos-cloud-db:5432/nobi_photos_cloud?search_path=auth',
 'GOTRUE_DB_MAX_POOL_SIZE':'4','GOTRUE_DB_MAX_IDLE_POOL_SIZE':'2','GOTRUE_DB_NAMESPACE':'auth',
 'GOTRUE_JWT_SECRET':secret,'GOTRUE_JWT_EXP':'3600','GOTRUE_JWT_AUD':'authenticated','GOTRUE_JWT_DEFAULT_GROUP_NAME':'authenticated','GOTRUE_JWT_ADMIN_ROLES':'service_role',
 'GOTRUE_JWT_ISSUER':'https://photos.nobistudio.com/auth/v1','GOTRUE_DISABLE_SIGNUP':'false','GOTRUE_EXTERNAL_EMAIL_ENABLED':'true',
 'GOTRUE_MAILER_AUTOCONFIRM':'false','GOTRUE_PASSWORD_MIN_LENGTH':'10','GOTRUE_RATE_LIMIT_EMAIL_SENT':'20',
 'GOTRUE_SMTP_HOST':'gateway','GOTRUE_SMTP_PORT':'1025','GOTRUE_SMTP_ADMIN_EMAIL':'noreply@photos.nobistudio.com','GOTRUE_SMTP_SENDER_NAME':'NOBI Photos TEST',
 'GOTRUE_SMTP_MAX_FREQUENCY':'1s','GOTRUE_MAILER_TEMPLATES_CONFIRMATION':'http://gateway:3000/templates/code','GOTRUE_MAILER_TEMPLATES_RECOVERY':'http://gateway:3000/templates/code',
 'GOTRUE_SECURITY_REFRESH_TOKEN_ROTATION_ENABLED':'true','GOTRUE_LOG_LEVEL':'error',
}
Path('secrets/auth.env').write_text('\n'.join(f'{k}={v}' for k,v in values.items())+'\n');os.chmod('secrets/auth.env',0o400)
Path('secrets/client.env').write_text(f'VITE_SUPABASE_URL=https://photos.nobistudio.com\nVITE_SUPABASE_PUBLISHABLE_KEY={anon}\n');os.chmod('secrets/client.env',0o400)
PY
{ printf "\\set auth_password '%s'\n" "$(cat secrets/auth-password)"; cat provision.sql; } | docker exec -i nobi-photos-cloud-db psql --no-psqlrc --set ON_ERROR_STOP=1 -U supabase_admin -d nobi_photos_cloud >/dev/null
docker compose config --quiet
docker compose up -d --pull never
for _ in $(seq 1 45); do
  if curl --silent --fail --max-time 3 http://127.0.0.1:15433/health >/dev/null; then
    date -u +%FT%TZ > initialized
    echo 'Isolated Supabase Auth ready; public registration remains disabled; SMTP capture accepts test recipients only.'
    exit 0
  fi
  sleep 2
done
echo 'Auth health not ready. Preserve deployment for diagnosis; do not overwrite secrets.' >&2
exit 1
