import { apiClient, getApiBaseUrl } from './client'
import type { Conversation, ResponseMode, SSEEvent } from '@/types/conversation'

export const conversationsApi = {
  /** 대화 시작 또는 기존 대화 반환 */
  start: async (entryId: string, responseMode: ResponseMode = 'empathetic'): Promise<Conversation> => {
    const res = await apiClient.post('/api/conversations', {
      entry_id: entryId,
      response_mode: responseMode,
    })
    return res.data.data.conversation
  },

  /** 대화 + 메시지 목록 조회 */
  get: async (convId: string): Promise<Conversation> => {
    const res = await apiClient.get(`/api/conversations/${convId}`)
    return res.data.data.conversation
  },

  /** response_mode 변경 */
  updateMode: async (convId: string, responseMode: ResponseMode): Promise<Conversation> => {
    const res = await apiClient.patch(`/api/conversations/${convId}`, { response_mode: responseMode })
    return res.data.data.conversation
  },

  /** 대화 전체 삭제 */
  delete: async (convId: string): Promise<void> => {
    await apiClient.delete(`/api/conversations/${convId}`)
  },

  /** 개별 메시지 삭제 */
  deleteMessage: async (messageId: string): Promise<void> => {
    await apiClient.delete(`/api/conversations/messages/${messageId}`)
  },

  /**
   * 메시지 전송 (SSE 스트리밍).
   * fetch를 직접 사용 — axios는 streaming을 지원하지 않는다.
   * onChunk: 청크 수신 시 호출
   * onDone: 완료 시 최종 메시지 전달
   * onCrisis: 위기 감지 시 위기 메시지 전달
   * onError: 에러 시 호출
   */
  sendMessage: async (
    convId: string,
    content: string,
    callbacks: {
      onChunk: (chunk: string) => void
      onDone: (msg: SSEEvent & { type: 'done' }) => void
      onCrisis: (msg: SSEEvent & { type: 'crisis' }) => void
      onError: (message: string) => void
    },
  ): Promise<void> => {
    const token = localStorage.getItem('mindlog-auth')
    let accessToken = ''
    if (token) {
      try {
        accessToken = JSON.parse(token)?.state?.accessToken || ''
      } catch {
        // ignore
      }
    }

    const base = getApiBaseUrl()
    const url = base ? `${base}/api/conversations/${convId}/messages` : `/api/conversations/${convId}/messages`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ content }),
    })

    if (!response.ok) {
      callbacks.onError('메시지 전송에 실패했습니다.')
      return
    }

    const reader = response.body?.getReader()
    if (!reader) {
      callbacks.onError('스트림을 읽을 수 없습니다.')
      return
    }

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data: ')) continue
        try {
          const event: SSEEvent = JSON.parse(trimmed.slice(6))
          if (event.type === 'chunk') callbacks.onChunk(event.content)
          else if (event.type === 'done') callbacks.onDone(event)
          else if (event.type === 'crisis') callbacks.onCrisis(event)
          else if (event.type === 'error') callbacks.onError(event.message)
        } catch {
          // malformed SSE line, skip
        }
      }
    }
  },
}
