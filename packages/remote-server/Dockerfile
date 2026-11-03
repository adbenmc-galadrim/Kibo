FROM oven/bun:1.4.2-slim AS build
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile --ignore-scripts
ARG SOURCE_COMMIT
ARG KIBO_BUILD_ID
RUN KIBO_BUILD_ID="${KIBO_BUILD_ID:-${SOURCE_COMMIT:-$(date +%s)}}" bun run build:phone
RUN find . -name node_modules -type d -prune -exec rm -rf {} + \
  && bun install --frozen-lockfile --ignore-scripts --production --filter @kibo/remote-server

FROM oven/bun:1.4.2-slim
WORKDIR /app
ENV NODE_ENV=production \
  KIBO_REMOTE_PORT=8080 \
  KIBO_REMOTE_DB=/data/kibo-remote.db \
  KIBO_REMOTE_STATIC=/app/packages/phone/dist
COPY --from=build /app/package.json /app/tsconfig.base.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/schema ./packages/schema
COPY --from=build /app/packages/remote ./packages/remote
COPY --from=build /app/packages/remote-server ./packages/remote-server
COPY --from=build /app/packages/phone/dist ./packages/phone/dist
RUN mkdir -p /data && chown bun:bun /data
USER bun
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["bun", "-e", "const r = await fetch('http://127.0.0.1:8080/api/health').catch(() => null); process.exit(r?.ok ? 0 : 1)"]
CMD ["bun", "packages/remote-server/src/main.ts"]
