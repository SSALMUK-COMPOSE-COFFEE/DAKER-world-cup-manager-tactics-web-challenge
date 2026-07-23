/**
 * 유저 피드백용 진동(햅틱) 헬퍼.
 * 조작·결과에 촉각 반응을 붙여 "내 결정이 먹혔다"는 손맛을 준다.
 *
 * navigator.vibrate 미지원 환경(데스크탑·iOS Safari)에서는 조용히 no-op —
 * 실제 진동은 모바일 크롬/안드로이드 웹뷰 등에서만 동작한다.
 * 패턴 배열은 [진동, 정지, 진동, ...] ms 순서.
 */
type Pattern = number | number[]

const supported = () =>
  typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'

function buzz(pattern: Pattern) {
  if (!supported()) return
  try {
    navigator.vibrate(pattern)
  } catch {
    /* 일부 브라우저는 사용자 제스처 밖 호출을 막는다 — 무시 */
  }
}

export const haptics = {
  /** 토큰 놓기·상세 열기 등 가벼운 확인 */
  tap: () => buzz(8),
  /** 교체·포메이션 확정 등 결정 */
  select: () => buzz(18),
  /** 휘슬 — 짧게-길게-짧게 */
  whistle: () => buzz([30, 50, 30]),
  /** 득점 — 두 번 강하게 */
  goal: () => buzz([90, 60, 120]),
  /** 실점 — 길고 둔하게 */
  goalAgainst: () => buzz(200),
  /** 도전 성공 */
  win: () => buzz([40, 40, 40, 40, 140]),
  /** 도전 실패 */
  lose: () => buzz(160),
}
