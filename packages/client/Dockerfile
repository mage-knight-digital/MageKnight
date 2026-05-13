FROM oven/bun:1 AS builder
WORKDIR /build

# Install step — cache this layer separately from source
COPY package.json bun.lock ./
COPY packages/client/package.json packages/client/
COPY packages/shared/package.json packages/shared/
COPY packages/mage-dev/package.json packages/mage-dev/
RUN bun install --frozen-lockfile

# Source
COPY packages/client/ packages/client/
COPY packages/shared/ packages/shared/
COPY packages/mage-dev/ packages/mage-dev/

ARG VITE_ASSETS_BASE_URL=https://assets.mageknightdigital.app/mageknight/v1/assets
ENV VITE_ASSETS_BASE_URL=$VITE_ASSETS_BASE_URL

RUN bun run --filter @mage-knight/shared build && \
    bun run --filter @mage-knight/client build

FROM caddy:2-alpine
COPY --from=builder /build/packages/client/dist /srv
COPY packages/client/Caddyfile /etc/caddy/Caddyfile
EXPOSE 80 443
