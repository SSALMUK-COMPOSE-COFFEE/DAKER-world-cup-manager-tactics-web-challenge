import { useEffect } from 'react'
import { useGameStore } from './store/gameStore'
import { decodeName } from './data/share'
import { initSound } from './lib/sound'
import { IntroScreen } from './screens/IntroScreen'
import { BriefingScreen } from './screens/BriefingScreen'
import { BoardScreen } from './screens/BoardScreen'
import { ResultScreen } from './screens/ResultScreen'

export default function App() {
  const screen = useGameStore((s) => s.screen)
  const init = useGameStore((s) => s.init)

  useEffect(() => {
    initSound()
    void init().then(() => {
      // 도전장 링크(#t=...&n=...)로 진입한 경우 해당 전술을 보드에 로드
      const m = location.hash.match(/^#t=([^&]+)(?:&n=([^&]+))?$/)
      if (m) {
        history.replaceState(null, '', location.pathname)
        const nickname = m[2] ? (decodeName(decodeURIComponent(m[2])) ?? undefined) : undefined
        void useGameStore.getState().loadSharedTactic(decodeURIComponent(m[1]), nickname)
      }
    })
  }, [init])

  switch (screen) {
    case 'intro':
      return <IntroScreen />
    case 'briefing':
      return <BriefingScreen />
    case 'board':
      return <BoardScreen />
    case 'result':
      return <ResultScreen />
  }
}
