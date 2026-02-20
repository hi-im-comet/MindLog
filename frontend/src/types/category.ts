export interface JournalCategory {
  id: string
  name: string
  icon: string | null
  color: string | null
  is_default: boolean
  display_order: number
  is_active: boolean
}

export interface CategoryCreateInput {
  name: string
  icon?: string
  color?: string
  display_order?: number
}
