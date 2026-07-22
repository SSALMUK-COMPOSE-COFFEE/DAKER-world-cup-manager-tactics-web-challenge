# 빌드 컨텍스트는 레포 루트(compose에서 context: .) — data/를 함께 복사하기 위함
FROM node:22-alpine AS build
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
COPY data/ /app/data/
RUN npm run build

FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/web/dist /srv
