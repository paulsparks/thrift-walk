# syntax=docker/dockerfile:1
# Both game targets use this export stage, so browser and server stay in sync.
FROM debian:bookworm-slim AS godot-export
ARG GODOT_VERSION=4.7.2
ARG TARGETARCH
RUN test "${TARGETARCH}" = amd64 || (echo 'Godot exports currently require linux/amd64' >&2; exit 1)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl unzip libfontconfig1 libgl1 libx11-6 libxcursor1 \
    libxinerama1 libxrandr2 libxi6 libasound2 libpulse0 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /tmp/godot
RUN set -eu; base="https://github.com/godotengine/godot-builds/releases/download/${GODOT_VERSION}-stable"; \
    editor="Godot_v${GODOT_VERSION}-stable_linux.x86_64.zip"; \
    templates="Godot_v${GODOT_VERSION}-stable_export_templates.tpz"; \
    curl -fSL --retry 3 "$base/$editor" -o "$editor"; \
    curl -fSL --retry 3 "$base/$templates" -o "$templates"; \
    curl -fSL --retry 3 "$base/SHA512-SUMS.txt" -o SHA512-SUMS.txt; \
    grep -F " $editor" SHA512-SUMS.txt > checksums; \
    grep -F " $templates" SHA512-SUMS.txt >> checksums; \
    sha512sum -c checksums; \
    unzip -q "$editor"; \
    install -m 755 "Godot_v${GODOT_VERSION}-stable_linux.x86_64" /usr/local/bin/godot; \
    unzip -q "$templates"; \
    mkdir -p "/root/.local/share/godot/export_templates/${GODOT_VERSION}.stable"; \
    mv templates/* "/root/.local/share/godot/export_templates/${GODOT_VERSION}.stable/"; \
    rm -rf /tmp/godot
WORKDIR /build/game
COPY game/ ./
RUN if grep -RIl '^version https://git-lfs.github.com/spec/v1' resources; then \
        echo 'Missing Git LFS assets. Run git lfs pull before building.' >&2; exit 1; fi
RUN mkdir -p /out/web /out/server \
    && godot --headless --editor --import --path . \
    && godot --headless --path . --export-release Web /out/web/index.html \
    && godot --headless --path . --export-release Server /out/server/ThriftWalk.x86_64

FROM node:24-bookworm-slim AS web-deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates openssl python3 make g++ \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g pnpm@11.27.0
WORKDIR /app
COPY web/package.json web/pnpm-lock.yaml web/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# CLI dependencies and migration engines stay out of the Next.js runtime image.
FROM web-deps AS tools
COPY --chown=node:node web/ ./
COPY --chmod=755 deploy/web-entrypoint.sh /usr/local/bin/web-entrypoint
RUN pnpm exec zen generate \
    && pnpm exec prisma --version \
    && mkdir -p /data/media && chown -R node:node /app/zenstack /data
USER node
ENTRYPOINT ["web-entrypoint"]
CMD ["pnpm", "exec", "zen", "migrate", "deploy"]

FROM web-deps AS web-build
COPY web/ ./
COPY --from=godot-export /out/web/ ./public/game/
ENV NEXT_TELEMETRY_DISABLED=1
# Build-time placeholders are not deployment credentials. Runtime values come
# exclusively from Compose; none are NEXT_PUBLIC or passed as build arguments.
RUN pnpm exec zen generate \
    && DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build \
       BETTER_AUTH_URL=https://build.invalid \
       BETTER_AUTH_SECRET=build-only-placeholder-not-a-runtime-secret \
       pnpm exec next build --webpack

FROM node:24-bookworm-slim AS web
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 MEDIA_ROOT=/data/media
COPY --from=web-build --chown=node:node /app/.next/standalone ./
COPY --from=web-build --chown=node:node /app/.next/static ./.next/static
COPY --from=web-build --chown=node:node /app/public ./public
COPY --chmod=755 deploy/web-entrypoint.sh /usr/local/bin/web-entrypoint
RUN mkdir -p /data/media /app/.next/cache && chown -R node:node /data /app/.next/cache
USER node
EXPOSE 3000
ENTRYPOINT ["web-entrypoint"]
CMD ["node", "server.js"]

FROM debian:bookworm-slim AS game
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates libfontconfig1 libgl1 libx11-6 libxcursor1 libxinerama1 \
    libxrandr2 libxi6 libasound2 libpulse0 netcat-openbsd \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 game
WORKDIR /app
COPY --from=godot-export --chown=game:game /out/server/ ./
USER game
EXPOSE 8080
ENTRYPOINT ["./ThriftWalk.x86_64", "--headless"]
