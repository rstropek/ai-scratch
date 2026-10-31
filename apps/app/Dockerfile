# Production image of the kids' app: the Hono server (TypeScript run directly by Node) + the built client, Scratch
# bundle and slide deck. The context is the repo root (the workspace's lock file lives there):
# docker build -f apps/app/Dockerfile --build-arg APP_VERSION=$(git rev-parse HEAD) -t ai-scratch .
FROM node:24-slim AS build
WORKDIR /repo
# npm ci checks every workspace against the lock file, so the office's package.json comes along; -w installs only the app's packages
COPY package.json package-lock.json .npmrc ./
COPY apps/office/package.json ./apps/office/
COPY apps/app/package.json ./apps/app/
COPY apps/app/scripts ./apps/app/scripts
RUN npm ci -w apps/app --no-audit --no-fund
COPY apps/app/slides/package.json apps/app/slides/package-lock.json ./apps/app/slides/
RUN npm ci --prefix apps/app/slides --no-audit --no-fund
COPY tsconfig.base.json ./
COPY apps/app ./apps/app
# the deck first (into dist/slides), so the app's build precompresses it with the rest of dist/
RUN npm run build --prefix apps/app/slides && npm run build -w apps/app

# only the server's packages; the browser ones are devDependencies, bundled into dist/ by Vite
FROM node:24-slim AS deps
WORKDIR /repo
COPY package.json package-lock.json .npmrc ./
COPY apps/office/package.json ./apps/office/
COPY apps/app/package.json ./apps/app/
RUN npm ci -w apps/app --omit=dev --ignore-scripts --no-audit --no-fund

FROM node:24-slim
ARG APP_VERSION=dev
ENV NODE_ENV=production APP_VERSION=$APP_VERSION PORT=3000
WORKDIR /app
COPY --from=deps /repo/node_modules ./node_modules
COPY apps/app/package.json ./
COPY apps/app/src/server ./src/server
COPY apps/app/src/shared ./src/shared
COPY --from=build /repo/apps/app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "src/server/main.ts"]
