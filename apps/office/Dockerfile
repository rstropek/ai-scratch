# The office's image, built from the repo root: docker build -f apps/office/Dockerfile .
FROM node:24-slim AS build
WORKDIR /repo
COPY package.json package-lock.json .npmrc ./
# npm checks the lock file against every workspace's package.json
COPY apps/app/package.json ./apps/app/
COPY apps/office/package.json ./apps/office/
COPY packages/db/package.json ./packages/db/
RUN npm ci -w apps/office --ignore-scripts --no-audit --no-fund
COPY tsconfig.base.json ./
COPY packages/db ./packages/db
COPY apps/office ./apps/office
RUN npm run build -w apps/office

# Next.js's standalone output: the traced packages, the server, the static files and the migrations
FROM node:24-slim
ARG APP_VERSION=dev
ENV NODE_ENV=production APP_VERSION=$APP_VERSION PORT=3100 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/office/.next/standalone ./
USER node
EXPOSE 3100
CMD ["node", "apps/office/server.js"]
