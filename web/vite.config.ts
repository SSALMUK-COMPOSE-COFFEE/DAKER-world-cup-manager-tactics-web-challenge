import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

// 시나리오 JSON은 레포 루트 data/에 있다(웹 코드와 분리, 검증 스크립트가 직접 읽음).
// dev에서는 /data/*를 루트 data/에서 서빙하고, build 시 dist/data로 복사한다.
const dataDir = path.resolve(__dirname, '../data')

function repoData(): Plugin {
  return {
    name: 'repo-data',
    configureServer(server) {
      server.middlewares.use('/data', (req, res) => {
        const url = (req.url ?? '').split('?')[0]
        const file = path.join(dataDir, decodeURIComponent(url))
        if (file.startsWith(dataDir) && fs.existsSync(file) && fs.statSync(file).isFile()) {
          res.setHeader('Content-Type', 'application/json')
          fs.createReadStream(file).pipe(res)
        } else {
          // SPA 폴백(index.html 200)으로 넘어가면 fetch가 HTML을 JSON으로 파싱하게 된다
          res.statusCode = 404
          res.end('not found')
        }
      })
    },
    closeBundle() {
      fs.cpSync(dataDir, path.resolve(__dirname, 'dist/data'), { recursive: true })
    },
  }
}

export default defineConfig({
  plugins: [react(), repoData()],
})
