import type { EngineOutput } from './types'

/**
 * 전술 점수 → 감독 등급, 지표 성향 → 감독 칭호.
 * 순수 함수(같은 전술 = 같은 등급/칭호)로 결과 화면·공유에 재사용한다.
 * compositeFinal은 0~100(50이 기준선)이라 임계값을 그에 맞춰 잡았다.
 */
export type Grade = 'S' | 'A' | 'B' | 'C' | 'D'

export function gradeOf(score: number): Grade {
  if (score >= 82) return 'S'
  if (score >= 70) return 'A'
  if (score >= 58) return 'B'
  if (score >= 46) return 'C'
  return 'D'
}

export interface ManagerTitle {
  title: string
  flavor: string
}

/**
 * 전술 지표에서 가장 두드러진 성향으로 감독 칭호를 결정.
 * 극단적 성향부터 우선순위로 매칭하고, 없으면 기본 칭호로 폴백(결정론적).
 */
export function managerTitle(e: EngineOutput): ManagerTitle {
  const T = (title: string, flavor: string): ManagerTitle => ({ title, flavor })

  if (e.ATT >= 70 && e.xG >= 1.1 && e.RISK >= 55)
    return T('닥공 스페셜리스트', '앞만 보고 달렸다. 골이 최고의 수비다.')
  if (e.DEF >= 70 && e.xGA <= 0.5)
    return T('자물쇠 수비 장인', '한 골도 내주지 않겠다는 집념.')
  if (e.PRESS >= 68 && e.xG >= 0.9)
    return T('게겐프레싱 마에스트로', '전방부터 상대의 숨통을 조였다.')
  if (e.RISK >= 70)
    return T('벼랑 끝 승부사', '모 아니면 도. 심장이 뛴다.')
  if (e.BALANCE >= 80)
    return T('균형의 설계자', '공수 어느 쪽도 흔들리지 않는다.')
  if (e.RISK < 40 && e.xG < 0.85)
    return T('안전제일 실리주의자', '지지 않는 축구, 그것도 전략이다.')
  if (e.ATT >= 62 && e.DEF >= 62)
    return T('토탈 풋볼리스트', '공격도 수비도 모두가 함께.')
  return T('현실주의 지휘관', '주어진 패로 최선을 뽑아냈다.')
}
