/**
 * 매일 자동 잠금 유틸리티.
 *
 * 동작 원리:
 *   - 잠금 해제 성공 시 오늘 날짜(KST)를 localStorage에 저장
 *   - 다음 날 앱을 열면 저장된 날짜 ≠ 오늘 → isExpired=true → 비밀번호 재요구
 *   - 디바이스 스코프 (기기별 독립). 다기기 동기화 없음.
 *
 * 타임존: Asia/Seoul 고정 (앱 대상 사용자 기준)
 */

const STORAGE_KEY = 'daily_lock_unlocked_date'

/** KST 기준 오늘 날짜 문자열 (YYYY-MM-DD) */
function getTodayKST(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
}

/** 오늘 잠금 해제 완료로 기록 */
export function markDailyUnlocked(): void {
  try {
    localStorage.setItem(STORAGE_KEY, getTodayKST())
  } catch {
    // localStorage 접근 불가 환경 무시
  }
}

/**
 * 매일 자동 잠금이 만료됐는지 확인.
 * @param dailyLockEnabled 사용자 설정값. false이면 항상 false 반환.
 */
export function isDailyLockExpired(dailyLockEnabled: boolean): boolean {
  if (!dailyLockEnabled) return false
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored !== getTodayKST()
  } catch {
    return true  // 읽기 실패 시 잠금으로 처리
  }
}

/** 저장된 잠금 해제 날짜 초기화 (잠금 기능 비활성화 시) */
export function clearDailyUnlock(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch { /* ignore */ }
}
