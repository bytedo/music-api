# ---- deps ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build ----
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- runner ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV ENABLE_DOWNLOAD=1

# Don't run as root
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 hono

# dist 由 tsup 打包，已内联 axios/cheerio，运行时无需 node_modules；
# package.json 仅用于让 Node 以 "type": "module" 解析 dist/index.js
COPY --from=build --chown=hono:nodejs /app/dist ./dist
COPY --from=build --chown=hono:nodejs /app/package.json ./package.json

USER hono

EXPOSE 3000

CMD ["node", "dist/index.js"]
