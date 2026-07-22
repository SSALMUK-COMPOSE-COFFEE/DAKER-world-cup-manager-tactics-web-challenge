import { useState } from 'react'
import { buildShareUrl } from '../data/share'
import type { LineupSlot, Player } from '../engine/types'

/** 현재 전술을 공유 링크로 복사. 클립보드 실패 시 프롬프트로 폴백 */
export function ShareButton({
  scenarioId,
  lineup,
  squad,
  className = 'ghost-btn small',
}: {
  scenarioId: string
  lineup: LineupSlot[]
  squad: Player[]
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  const share = async () => {
    const url = buildShareUrl(scenarioId, lineup, squad)
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      window.prompt('링크를 복사하세요', url)
    }
  }

  return (
    <button className={className} onClick={share}>
      {copied ? '링크 복사됨!' : '전술 공유'}
    </button>
  )
}
