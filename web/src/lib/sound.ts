/**
 * 유저 피드백용 효과음 — Web Audio API로 코드 합성.
 * 외부 음원 파일 없이 오실레이터/노이즈로 생성하므로 의존성 0, CSP 안전, 로딩 지연 0.
 *
 * 브라우저 autoplay 정책상 첫 사용자 제스처 전에는 소리가 나지 않는다.
 * 이 앱의 모든 효과음은 클릭/터치로 트리거되므로 context()가 그 제스처 안에서 resume된다.
 */

let ctx: AudioContext | null = null
let muted = false
const MUTE_KEY = 'planb.muted'

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    try {
      ctx = new AC()
    } catch {
      return null
    }
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** 앱 시작 시 저장된 음소거 상태 복원 */
export function initSound() {
  try {
    muted = localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    /* 무시 */
  }
}

export function isMuted() {
  return muted
}

/** 음소거 토글 → 변경된 상태 반환 */
export function toggleMute() {
  muted = !muted
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
  } catch {
    /* 무시 */
  }
  if (!muted) context() // 켜는 순간 오디오 컨텍스트 깨우기
  return muted
}

/** 첫 제스처에서 오디오 컨텍스트 미리 unlock */
export function resumeAudio() {
  context()
}

/** 어택→릴리즈 엔벨로프 게인 노드 (클릭 노이즈 방지용 exponential ramp) */
function envGain(c: AudioContext, t0: number, peak: number, attack: number, release: number): GainNode {
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + release)
  g.connect(c.destination)
  return g
}

/** 토큰 놓기·탭 — 짧은 "톡" */
function tick() {
  const c = context()
  if (!c || muted) return
  const t = c.currentTime
  const o = c.createOscillator()
  o.type = 'triangle'
  o.frequency.setValueAtTime(200, t)
  o.frequency.exponentialRampToValueAtTime(120, t + 0.06)
  const g = envGain(c, t, 0.18, 0.005, 0.06)
  o.connect(g)
  o.start(t)
  o.stop(t + 0.09)
}

/** 포메이션 전환 — 짧은 상승 스윕 */
function slide() {
  const c = context()
  if (!c || muted) return
  const t = c.currentTime
  const o = c.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(320, t)
  o.frequency.exponentialRampToValueAtTime(640, t + 0.14)
  const g = envGain(c, t, 0.12, 0.02, 0.13)
  o.connect(g)
  o.start(t)
  o.stop(t + 0.18)
}

/** 심판 휘슬 — 고음 삐————익 (페어 트릴 진폭 변조) */
function whistle() {
  const c = context()
  if (!c || muted) return
  const t = c.currentTime
  const dur = 0.55
  const o = c.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(2300, t)
  o.frequency.linearRampToValueAtTime(2500, t + dur)

  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.22, t + 0.03)
  g.gain.setValueAtTime(0.22, t + dur - 0.06)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)

  // 페어(pea) 떨림: 진폭을 빠르게 흔들어 실제 호루라기 질감
  const trill = c.createOscillator()
  trill.type = 'sine'
  trill.frequency.value = 30
  const trillGain = c.createGain()
  trillGain.gain.value = 0.05
  trill.connect(trillGain)
  trillGain.connect(g.gain)

  o.connect(g)
  g.connect(c.destination)
  o.start(t)
  o.stop(t + dur)
  trill.start(t)
  trill.stop(t + dur)
}

/** 득점 — 관중 함성(필터드 화이트노이즈 스웰) */
function cheer() {
  const c = context()
  if (!c || muted) return
  const t = c.currentTime
  const dur = 1.3
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const src = c.createBufferSource()
  src.buffer = buf

  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 0.6
  bp.frequency.setValueAtTime(500, t)
  bp.frequency.linearRampToValueAtTime(1100, t + 0.25) // 함성이 밝게 솟구침

  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(0.32, t + 0.18)
  g.gain.setValueAtTime(0.3, t + 0.5)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)

  src.connect(bp)
  bp.connect(g)
  g.connect(c.destination)
  src.start(t)
  src.stop(t + dur)
}

/** 실점 — 낮게 떨어지는 둔탁한 소리 */
function thud() {
  const c = context()
  if (!c || muted) return
  const t = c.currentTime
  const o = c.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(140, t)
  o.frequency.exponentialRampToValueAtTime(55, t + 0.3)
  const g = envGain(c, t, 0.3, 0.01, 0.34)
  o.connect(g)
  o.start(t)
  o.stop(t + 0.4)
}

/** 도전 성공 — 상승 아르페지오 */
function win() {
  const c = context()
  if (!c || muted) return
  const t = c.currentTime
  ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    const s = t + i * 0.1
    const o = c.createOscillator()
    o.type = 'triangle'
    o.frequency.value = f
    const g = envGain(c, s, 0.18, 0.01, 0.18)
    o.connect(g)
    o.start(s)
    o.stop(s + 0.2)
  })
}

/** 도전 실패 — 하강 두 음 */
function lose() {
  const c = context()
  if (!c || muted) return
  const t = c.currentTime
  ;[440, 330].forEach((f, i) => {
    const s = t + i * 0.14
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.value = f
    const g = envGain(c, s, 0.16, 0.01, 0.24)
    o.connect(g)
    o.start(s)
    o.stop(s + 0.28)
  })
}

export const sound = { tick, slide, whistle, cheer, thud, win, lose }
