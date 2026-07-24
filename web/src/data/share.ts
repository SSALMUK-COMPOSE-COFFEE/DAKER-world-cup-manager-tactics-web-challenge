// 전술 공유 링크(도전장) — 라인업을 URL 해시에 비트 패킹으로 압축 인코딩(서버 저장 없음).
// 형식: #t=<scenarioId>.<base64url 32바이트>[&n=<base64url 닉네임>]
// 선수당 23비트(스쿼드idx 5 + x 7 + y 7 + 역할idx 4) × 11명 = 253비트 → 32바이트 → 43자.
// 카톡 등 메신저 공유를 고려해 해시 부분을 최대한 압축(전술 43자 + 닉네임 선택).
// 점수는 링크에 싣지 않는다 — 받는 쪽이 동일 엔진으로 재계산하므로 위조 불가.
import type { LineupSlot, Player } from '../engine/types'

const ROLES = ['GK', 'LB', 'CB', 'RB', 'LWB', 'RWB', 'DM', 'CM', 'AM', 'LM', 'RM', 'LW', 'RW', 'ST', 'CF', 'FW']

class BitWriter {
  private bytes: number[] = []
  private acc = 0
  private nbits = 0

  write(value: number, bits: number) {
    this.acc = (this.acc << bits) | (value & ((1 << bits) - 1))
    this.nbits += bits
    while (this.nbits >= 8) {
      this.nbits -= 8
      this.bytes.push((this.acc >>> this.nbits) & 0xff)
    }
  }

  finish(): Uint8Array {
    if (this.nbits > 0) this.bytes.push((this.acc << (8 - this.nbits)) & 0xff)
    return Uint8Array.from(this.bytes)
  }
}

class BitReader {
  private bytes: Uint8Array
  private pos = 0
  private acc = 0
  private nbits = 0

  constructor(bytes: Uint8Array) {
    this.bytes = bytes
  }

  read(bits: number): number {
    while (this.nbits < bits) {
      if (this.pos >= this.bytes.length) return -1
      this.acc = (this.acc << 8) | this.bytes[this.pos++]
      this.nbits += 8
    }
    this.nbits -= bits
    return (this.acc >>> this.nbits) & ((1 << bits) - 1)
  }
}

const toB64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

function fromB64url(s: string): Uint8Array | null {
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
    return Uint8Array.from(bin, (c) => c.charCodeAt(0))
  } catch {
    return null
  }
}

export function encodeTactic(scenarioId: string, lineup: LineupSlot[], squad: Player[]): string | null {
  const ids = squad.map((p) => p.id)
  const bw = new BitWriter()
  for (const s of lineup) {
    const pi = ids.indexOf(s.playerId)
    const ri = ROLES.indexOf(s.role)
    if (pi < 0 || pi > 31 || ri < 0) return null
    bw.write(pi, 5)
    bw.write(Math.round(s.x), 7)
    bw.write(Math.round(s.y), 7)
    bw.write(ri, 4)
  }
  return `${scenarioId}.${toB64url(bw.finish())}`
}

export interface DecodedSlot {
  idx: number
  x: number
  y: number
  role: string
}

export function decodeTactic(raw: string): { scenarioId: string; slots: DecodedSlot[] } | null {
  const sep = raw.lastIndexOf('.')
  if (sep <= 0) return null
  const scenarioId = raw.slice(0, sep)
  const bytes = fromB64url(raw.slice(sep + 1))
  if (!bytes || bytes.length < 32) return null

  const br = new BitReader(bytes)
  const slots: DecodedSlot[] = []
  for (let i = 0; i < 11; i++) {
    const idx = br.read(5)
    const x = br.read(7)
    const y = br.read(7)
    const ri = br.read(4)
    const role = ROLES[ri]
    if (idx < 0 || x < 0 || x > 100 || y < 0 || y > 100 || !role) return null
    slots.push({ idx, x, y, role })
  }
  return { scenarioId, slots }
}

export function encodeName(name: string): string {
  return toB64url(new TextEncoder().encode(name))
}

export function decodeName(s: string): string | null {
  const bytes = fromB64url(s)
  if (!bytes) return null
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return null
  }
}

export function buildShareUrl(
  scenarioId: string,
  lineup: LineupSlot[],
  squad: Player[],
  nickname?: string,
): string | null {
  const t = encodeTactic(scenarioId, lineup, squad)
  if (!t) return null
  const name = nickname?.trim()
  const n = name ? `&n=${encodeName(name.slice(0, 16))}` : ''
  return `${location.origin}${location.pathname}#t=${t}${n}`
}
