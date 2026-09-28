FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY bot.js api.js ./
COPY src ./src
COPY miniapp ./miniapp
COPY certs ./certs

ENV NODE_ENV=production
ENV NODE_EXTRA_CA_CERTS=/app/certs/russian_trusted_ca_bundle.pem

CMD ["node", "bot.js"]
