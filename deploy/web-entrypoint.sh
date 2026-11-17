#!/bin/sh
set -eu
# Build the URL at runtime so passwords with reserved URL characters also work.
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
export DATABASE_URL
DATABASE_URL="$(node -e '
const password = encodeURIComponent(process.env.POSTGRES_PASSWORD);
process.stdout.write(`postgresql://thriftwalk:${password}@postgres:5432/thriftwalk`);
')"
exec "$@"
