export type ResponseMode = 'empathetic' | 'advice' | 'pattern_recognition'

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  crisis_flag: boolean
  created_at: string
}

export interface Conversation {
  id: string
  entry_id: string
  response_mode: ResponseMode
  is_active: boolean
  message_count: number
  messages?: ConversationMessage[]
  created_at: string
}

// SSE event payloads
export type SSEEvent =
  | { type: 'chunk'; content: string }
  | { type: 'done'; message: ConversationMessage; user_message_id?: string }
  | { type: 'crisis'; content: string }
  | { type: 'error'; message: string }
