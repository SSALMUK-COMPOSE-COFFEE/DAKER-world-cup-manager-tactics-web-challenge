import { useState } from 'react'
import { buildShareUrl } from '../data/share'
import { loadNickname } from '../data/progress'
import type { LineupSlot, Player } from '../engine/types'

/** 현재 전술을 도전장 링크로 복사. 클립보드 실패 시 프롬프트로 폴백.
 *  리더보드에 쓴 감독 이름이 있으면 링크에 함께 실린다. */
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
    const url = buildShareUrl(scenarioId, lineup, squad, loadNickname() ?? undefined)
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
      {copied ? '도전장 복사됨!' : '도전장 보내기'}
    </button>
  )
}
