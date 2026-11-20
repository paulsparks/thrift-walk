#!/usr/bin/env bash
set -euo pipefail

repo=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)
deploy_dir=$(dirname -- "$repo")
source_dir="./$(basename -- "$repo")"
if [[ ${1:-} == --in-checkout ]]; then
    deploy_dir=$repo
    source_dir=.
    shift
fi
cd -- "$deploy_dir"
umask 077
set -o noclobber

if [[ $# != 0 && $# != 2 ]]; then
    echo "Usage: configure.sh [--in-checkout] [market.example.com you@example.com]" >&2
    exit 1
fi
if [[ -f .env.production ]]; then
    echo "Using existing $deploy_dir/.env.production; existing settings take precedence."
else
    if [[ $# != 2 ]]; then
        echo "To create $deploy_dir/.env.production, supply a domain and certificate contact email." >&2
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
    cat > .env.production <<ENV
THRIFT_SOURCE_DIR='$source_dir'
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
    echo "Created $deploy_dir/.env.production (mode 600). Keep it private and backed up."
fi

# The postgres process must traverse the mount parent after dropping root.
if [[ ! -d database ]]; then
    mkdir -m 0711 database
fi
mkdir -p config storage/images storage/scans
if [[ ! -e docker-compose.yaml ]]; then
    cat "$repo/docker-compose.yaml" > docker-compose.yaml
fi
if [[ ! -e config/Caddyfile ]]; then
    cat "$repo/deploy/Caddyfile" > config/Caddyfile
fi
printf '%s\n' "Compose working directory: $deploy_dir" \
    'Prepare upload permissions: sudo chown 1000:1000 storage/images storage/scans && sudo chmod 750 storage/images storage/scans' \
    "For cloud scans and upgrades, follow $repo/deploy/README.md." \
    'Check configuration from the Compose directory: docker compose --env-file .env.production config -q'
