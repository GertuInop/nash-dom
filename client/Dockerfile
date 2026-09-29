# Сборка статики (лёгкий режим для VPS)
FROM node:20-alpine AS build

WORKDIR /app

ENV NPM_CONFIG_MAXSOCKETS=3
ENV NPM_CONFIG_FETCH_RETRIES=5
ENV NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000
ENV NODE_OPTIONS=--max-old-space-size=512

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY index.html ./
COPY public ./public
COPY src ./src
COPY tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY vite.config.ts ./

# Без tsc -b — экономия RAM; vite и так собирает production bundle
RUN npx vite build

# Раздача: уже скачанный caddy вместо отдельного nginx (меньше образов)
FROM caddy:2.8-alpine

COPY Caddyfile.static /etc/caddy/Caddyfile
COPY --from=build /app/dist /usr/share/caddy

EXPOSE 80
