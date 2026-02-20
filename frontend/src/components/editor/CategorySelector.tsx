import { clsx } from 'clsx'
import { JournalCategory } from '@/types/category'

interface Props {
  categories: JournalCategory[]
  selected: string[]
  onChange: (ids: string[]) => void
}

export function CategorySelector({ categories, selected, onChange }: Props) {
  const toggle = (id: string) => {
    onChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id]
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((cat) => (
        <button
          key={cat.id}
          type="button"
          onClick={() => toggle(cat.id)}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150 border',
            selected.includes(cat.id)
              ? 'border-primary-400 bg-primary-50 text-primary-700'
              : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
          )}
        >
          {cat.icon && <span>{cat.icon}</span>}
          {cat.name}
        </button>
      ))}
    </div>
  )
}
