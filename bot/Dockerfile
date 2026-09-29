FROM node:20-alpine

WORKDIR /app

# Меньше параллелизма — меньше RAM на слабых VPS
ENV NPM_CONFIG_MAXSOCKETS=3
ENV NPM_CONFIG_FETCH_RETRIES=5
ENV NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000
ENV NODE_OPTIONS=--max-old-space-size=384

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY bot.js api.js ./
COPY src ./src
COPY certs ./certs
COPY docs ./docs
COPY scripts ./scripts

ENV NODE_ENV=production
ENV NODE_EXTRA_CA_CERTS=/app/certs/russian_trusted_ca_bundle.pem
ENV NODE_OPTIONS=--max-old-space-size=256

CMD ["node", "bot.js"]
