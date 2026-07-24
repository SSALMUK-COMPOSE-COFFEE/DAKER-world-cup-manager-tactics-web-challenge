# 배포 — https://hajin.xyz/world-cup-manager-tactics-web-challenge

호스트 nginx(`/etc/nginx/sites-enabled/hajin.xyz`)가 경로 프리픽스를 벗겨
`127.0.0.1:18085`(Docker Caddy)로 프록시한다. HTTPS는 호스트 Let's Encrypt 담당.

```
브라우저 → nginx(443, 프리픽스 제거) → 127.0.0.1:18085 Caddy(정적)
                                          └─ /api/* → server:8000 (리더보드, compose profile)
```

## 호스트 nginx 설정 (1회)

`location /media-stats-analysis-competition/` 블록 위쪽에 추가:

```nginx
# PLAN B (world-cup-manager-tactics-web-challenge)
location = /world-cup-manager-tactics-web-challenge {
    return 301 /world-cup-manager-tactics-web-challenge/;
}

# proxy_pass 끝의 / 가 프리픽스를 벗겨서 전달한다 (컨테이너는 루트 기준)
location /world-cup-manager-tactics-web-challenge/ {
    proxy_pass http://127.0.0.1:18085/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Connection "";
}
```

적용 (자동): `sudo bash scripts/setup-nginx.sh`

적용 (수동):

```bash
sudo nano /etc/nginx/sites-enabled/hajin.xyz   # 블록 추가
sudo nginx -t && sudo systemctl reload nginx
```

> ⚠️ 설정 백업을 `sites-enabled/` **안에** 만들면 안 된다 — nginx가 디렉토리 전체를
> include하므로 백업 파일이 duplicate listen 오류를 일으킨다. 백업은 `/etc/nginx/backups/`에.

## 컨테이너 기동

```bash
# 코어(정적)만
docker compose up -d --build web

# 리더보드 포함
docker compose --profile leaderboard up -d --build
```

## 점검 체크리스트

- `curl -sI https://hajin.xyz/world-cup-manager-tactics-web-challenge/` → 200
- `curl -s https://hajin.xyz/world-cup-manager-tactics-web-challenge/api/health` → `{"ok":true,...}` (리더보드 기동 시)
- 리더보드 쿠키 Path는 `/world-cup-manager-tactics-web-challenge` (docker-compose `COOKIE_PATH`) — 배포 경로를 바꾸면 함께 변경
- 배포 경로는 `web/vite.config.ts`의 `BASE` 와 nginx location, `COOKIE_PATH` 세 곳이 일치해야 한다
