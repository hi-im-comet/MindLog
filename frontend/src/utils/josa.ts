/**
 * 한국어 조사 유틸리티
 * 마지막 글자의 받침(종성) 유무에 따라 올바른 조사를 반환한다.
 */

function hasBatchim(text: string): boolean {
  if (!text) return false
  const last = text.charCodeAt(text.length - 1)
  if (last < 0xAC00 || last > 0xD7A3) return false
  return (last - 0xAC00) % 28 > 0
}

/**
 * 받침 없음(수서) → 첫 번째 인자
 * 받침 있음(수성) → 두 번째 인자
 */
export function j(name: string, vowelForm: string, consonantForm: string): string {
  return hasBatchim(name) ? consonantForm : vowelForm
}

/** 와/과  (수서와, 수성과) */
export const wa = (name: string) => j(name, '와', '과')

/** 이와/와  (수서와, 수성이와) — 이름 뒤에 붙는 '~이와/와 대화하기' 형태 */
export const iwa = (name: string) => j(name, '와', '이와')

/** 이/가  subject particle (수서가, 수성이) */
export const ga = (name: string) => j(name, '가', '이')

/** 을/를  object particle (수서를, 수성을) */
export const eul = (name: string) => j(name, '를', '을')

/** 은/는  topic particle (수서는, 수성은) */
export const eun = (name: string) => j(name, '는', '은')

/** 이랑/랑  casual with (수서랑, 수성이랑) */
export const rang = (name: string) => j(name, '랑', '이랑')
