# Сборка статики
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html ./
COPY public ./public
COPY src ./src
COPY tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY vite.config.ts ./

RUN npm run build

# Раздача через nginx (entrypoint сам подставляет env в *.template)
FROM nginx:1.27-alpine

COPY nginx/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

ENV API_UPSTREAM=http://host.docker.internal:3080

EXPOSE 80
