# Production image: the Hono server (TypeScript run directly by Node) + the built client and Scratch bundle.
# Build: docker build --build-arg APP_VERSION=$(git rev-parse HEAD) -t ai-scratch .
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY scripts ./scripts
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# only the server's packages; the browser ones are devDependencies, bundled into dist/ by Vite
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund

FROM node:24-slim
ARG APP_VERSION=dev
ENV NODE_ENV=production APP_VERSION=$APP_VERSION PORT=3000
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src/server ./src/server
COPY src/shared ./src/shared
COPY --from=build /app/dist ./dist
RUN mkdir logs && chown node logs
USER node
EXPOSE 3000
CMD ["node", "src/server/main.ts"]
