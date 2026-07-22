import type { EngineOutput } from '../engine/types'

const BARS: { key: keyof EngineOutput; label: string; cls: string }[] = [
  { key: 'ATT', label: '공격', cls: 'att' },
  { key: 'DEF', label: '수비', cls: 'def' },
  { key: 'PRESS', label: '압박', cls: 'press' },
  { key: 'BALANCE', label: '밸런스', cls: 'balance' },
  { key: 'RISK', label: '리스크', cls: 'risk' },
]

export function Gauges({ engine }: { engine: EngineOutput }) {
  return (
    <div className="gauges">
      {BARS.map(({ key, label, cls }) => (
        <div className="gauge" key={key}>
          <span className="gauge-label">{label}</span>
          <div className="gauge-track">
            <div className={`gauge-fill ${cls}`} style={{ width: `${engine[key]}%` }} />
          </div>
          <span className="gauge-value">{Math.round(engine[key] as number)}</span>
        </div>
      ))}
      <div className="xg-row">
        <div className="xg-item">
          <span className="xg-label">예상 득점 xG</span>
          <span className="xg-value up">{engine.xG.toFixed(2)}</span>
        </div>
        <div className="xg-item">
          <span className="xg-label">실점 위험 xGA</span>
          <span className="xg-value down">{engine.xGA.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}
