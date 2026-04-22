# syntax=docker/dockerfile:1

FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx gulp scripts && npx gulp concatCss && npx gulp postCss

FROM nginx:1.27-alpine AS runtime
WORKDIR /usr/share/nginx/html

RUN rm -rf ./*
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/demo ./demo
COPY --from=builder /app/demo/demo.html ./index.html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1
