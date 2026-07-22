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
    void init()
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
