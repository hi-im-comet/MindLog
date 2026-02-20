import { JournalCategory } from './category'

export interface CategorySegment {
  category: string
  content: string
}

export interface JournalEntry {
  id: string
  entry_date: string
  title: string | null
  raw_content: string
  word_count: number | null
  mood_score: number | null
  energy_score: number | null
  daily_summary: string | null
  is_draft: boolean
  categories: JournalCategory[]
  category_segments?: CategorySegment[]
  has_conversation: boolean
  created_at: string
  updated_at: string
}

export interface CalendarDay {
  date: string
  has_entry: boolean
  entry_id?: string
  mood_score?: number | null
  summary?: string | null
  is_draft?: boolean
}

export interface EntryCreateInput {
  entry_date?: string
  title?: string
  raw_content: string
  mood_score?: number | null
  energy_score?: number | null
  category_ids?: string[]
  is_draft?: boolean
}

export interface EntryUpdateInput {
  title?: string
  raw_content?: string
  mood_score?: number | null
  energy_score?: number | null
  category_ids?: string[]
  is_draft?: boolean
}
