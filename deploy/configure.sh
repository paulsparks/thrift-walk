#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
if [[ $# != 2 ]]; then
    echo "Usage: ./deploy/configure.sh market.example.com you@example.com" >&2
    exit 1
fi
if [[ ! "$1" =~ ^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$ || "$1" != *.* ]]; then
    echo "Use a public domain name without a scheme, port or path." >&2
    exit 1
fi
if [[ ! "$2" =~ ^[a-zA-Z0-9._+%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
    echo "Enter a valid certificate contact email." >&2
    exit 1
fi
command -v openssl >/dev/null
database_password=$(openssl rand -hex 32)
auth_secret=$(openssl rand -hex 48)
game_secret=$(openssl rand -hex 48)
umask 077
# noclobber also prevents accidentally replacing development or deployment secrets.
set -o noclobber
cat > .env.production <<ENV
PUBLIC_ORIGIN=https://$1
ACME_EMAIL=$2
POSTGRES_PASSWORD=$database_password
BETTER_AUTH_SECRET=$auth_secret
GAME_SERVER_SECRET=$game_secret

# Optional: password-reset email delivery and Google sign-in.
RESET_EMAIL_WEBHOOK_URL=
RESET_EMAIL_WEBHOOK_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ENV
mkdir -p config database storage/images storage/models
if [[ ! -e config/Caddyfile ]]; then
    cp deploy/Caddyfile config/Caddyfile
fi
printf '%s\n' 'Created .env.production (mode 600). Keep it private and backed up.' \
    'Prepare upload permissions: sudo chown 1000:1000 storage/images && sudo chmod 750 storage/images' \
    'Start with: docker compose --env-file .env.production up -d --build'
