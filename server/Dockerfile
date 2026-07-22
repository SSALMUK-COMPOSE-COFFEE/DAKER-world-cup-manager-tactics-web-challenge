# 빌드 컨텍스트는 레포 루트 — 엔진(web/src/engine)과 data/를 함께 복사
FROM node:26-alpine
WORKDIR /app
COPY web/src/engine/ web/src/engine/
COPY data/ data/
COPY server/ server/
ENV PORT=8000 SQLITE_PATH=/data/planb.db
EXPOSE 8000
CMD ["node", "server/server.ts"]
