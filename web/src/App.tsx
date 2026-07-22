import { useEffect } from 'react'
import { useGameStore } from './store/gameStore'
import { IntroScreen } from './screens/IntroScreen'
import { BriefingScreen } from './screens/BriefingScreen'
import { BoardScreen } from './screens/BoardScreen'
import { ResultScreen } from './screens/ResultScreen'

export default function App() {
  const screen = useGameStore((s) => s.screen)
  const init = useGameStore((s) => s.init)

  useEffect(() => {
    void init().then(() => {
      // 공유 링크(#t=...)로 진입한 경우 해당 전술을 보드에 로드
      const m = location.hash.match(/^#t=(.+)$/)
      if (m) {
        history.replaceState(null, '', location.pathname)
        void useGameStore.getState().loadSharedTactic(decodeURIComponent(m[1]))
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
