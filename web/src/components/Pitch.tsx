import { useRef, type ReactNode } from 'react'
import { haptics } from '../lib/haptics'

/** 좌표 변환 컨텍스트를 제공하는 피치 컨테이너 + SVG 라인 마킹 */
export function Pitch({
  children,
  overlay,
  onDragTo,
}: {
  children: ReactNode
  overlay?: ReactNode
  /** 토큰 드래그 중 pointer 좌표를 0~100 피치 좌표로 변환해 전달 */
  onDragTo?: (playerId: string, x: number, y: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef<string | null>(null)
  const raf = useRef(0)
  const startPos = useRef({ x: 0, y: 0 })
  const moved = useRef(false)

  const toPitch = (clientX: number, clientY: number) => {
    const rect = ref.current!.getBoundingClientRect()
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    }
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-draggable-id]')
    if (!el || !onDragTo) return
    dragging.current = el.dataset.draggableId!
    el.setPointerCapture?.(e.pointerId)
    startPos.current = { x: e.clientX, y: e.clientY }
    moved.current = false
    // 드래그 중에는 토큰 위치 트랜지션(포메이션 슬라이드용)을 끈다 — 포인터 추종 지연 방지
    ref.current?.classList.add('dragging')
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging.current || !onDragTo) return
    const { clientX, clientY } = e
    // 4px 이상 움직였을 때만 드래그로 간주 — 탭(선수 상세)과 구분
    if (Math.hypot(clientX - startPos.current.x, clientY - startPos.current.y) < 4 && !moved.current) return
    moved.current = true
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => {
      if (!dragging.current) return
      const { x, y } = toPitch(clientX, clientY)
      onDragTo(dragging.current, x, y)
    })
  }

  const endDrag = () => {
    // 실제로 옮겨 놓았을 때만 촉각 확인(탭은 handleTokenClick 쪽에서 처리)
    if (dragging.current && moved.current) haptics.tap()
    dragging.current = null
    cancelAnimationFrame(raf.current)
    ref.current?.classList.remove('dragging')
  }

  return (
    <div
      ref={ref}
      className="pitch"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClickCapture={(e) => {
        // 실제 드래그였다면 뒤따르는 click을 삼켜 상세 카드 오작동 방지
        if (moved.current) {
          e.stopPropagation()
          moved.current = false
        }
      }}
    >
      <svg className="pitch-lines" viewBox="0 0 105 68" preserveAspectRatio="none">
        <rect x="0.5" y="0.5" width="104" height="67" />
        <line x1="52.5" y1="0.5" x2="52.5" y2="67.5" />
        <circle cx="52.5" cy="34" r="9.15" />
        <circle cx="52.5" cy="34" r="0.5" fill="currentColor" />
        {/* 페널티 박스 (좌: 우리 골문, 우: 상대 골문) */}
        <rect x="0.5" y="13.84" width="16.5" height="40.32" />
        <rect x="88" y="13.84" width="16.5" height="40.32" />
        <rect x="0.5" y="24.84" width="5.5" height="18.32" />
        <rect x="99" y="24.84" width="5.5" height="18.32" />
        {/* 엔진 기준선 가이드(은은하게): x<40 = 뒷선 카운트, x≥66 = 전진 카운트 */}
        <line className="zone-guide" x1="42" y1="0.5" x2="42" y2="67.5" />
        <line className="zone-guide" x1="69.3" y1="0.5" x2="69.3" y2="67.5" />
      </svg>
      {overlay}
      {children}
    </div>
  )
}
