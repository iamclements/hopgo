# syntax=docker/dockerfile:1

# Build stage: install the workspace and bundle the control plane into dist/.
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @hopgo/control-plane build

# Runtime stage: just Node + the bundle. No node_modules, nothing to wipe.
FROM node:22-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache su-exec
COPY --from=build /app/apps/control-plane/dist ./dist
COPY apps/control-plane/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8787 \
    PUID=1000 \
    PGID=1000
EXPOSE 8787

# Entrypoint remaps to PUID/PGID then drops privileges; the app never runs as root.
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
