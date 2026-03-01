import { apiClient, getApiBaseUrl } from './client'
import type {
  CheckIn,
  CheckInMessage,
  CheckInActionType,
  CreateCheckInPayload,
  UpdateCheckInPayload,
  ExtractedTask,
} from '@/types/reminder'

export interface SendMessageCallbacks {
  onChunk: (chunk: string) => void
  onDone: (message: CheckInMessage) => void
  onError: (message: string) => void
}

export const remindersApi = {
  list: async (status?: string): Promise<CheckIn[]> => {
    const params = status ? { status } : {}
    const res = await apiClient.get('/api/reminders', { params })
    return res.data.data.check_ins
  },

  create: async (payload: CreateCheckInPayload): Promise<CheckIn> => {
    const res = await apiClient.post('/api/reminders', payload)
    return res.data.data.check_in
  },

  extractTasks: async (entryId: string): Promise<ExtractedTask[]> => {
    const res = await apiClient.get('/api/reminders/extract', { params: { entry_id: entryId } })
    return res.data.data.tasks
  },

  get: async (id: string): Promise<CheckIn> => {
    const res = await apiClient.get(`/api/reminders/${id}`)
    return res.data.data.check_in
  },

  update: async (id: string, payload: UpdateCheckInPayload): Promise<CheckIn> => {
    const res = await apiClient.patch(`/api/reminders/${id}`, payload)
    return res.data.data.check_in
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/reminders/${id}`)
  },

  sendMessage: async (
    checkInId: string,
    content: string,
    actionType: CheckInActionType,
    callbacks: SendMessageCallbacks,
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
    const url = base
      ? `${base}/api/reminders/${checkInId}/messages`
      : `/api/reminders/${checkInId}/messages`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ content, action_type: actionType }),
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
          const event = JSON.parse(trimmed.slice(6))
          if (event.type === 'chunk') callbacks.onChunk(event.content)
          else if (event.type === 'done') callbacks.onDone(event.message)
          else if (event.type === 'error') callbacks.onError(event.message)
        } catch {
          // malformed SSE line
        }
      }
    }
  },
}
