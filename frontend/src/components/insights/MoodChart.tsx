import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import type { MoodDataPoint } from '@/types/pattern'

interface Props {
  data: MoodDataPoint[]
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length || !label) return null
  const date = parseISO(label)
  const dateStr = format(date, 'M월 d일 EEE', { locale: ko })
  return (
    <div className="bg-white border border-gray-100 shadow-sm rounded-lg px-3 py-2 text-xs">
      <p className="font-medium text-gray-700 mb-1">{dateStr}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name === 'mood' ? '기분' : '에너지'}: {p.value}/10
        </p>
      ))}
    </div>
  )
}

export function MoodChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-300 text-sm">
        아직 기록된 기분 데이터가 없어요
      </div>
    )
  }

  const chartData = data.map((d) => ({
    date: d.date,
    mood: d.mood,
    energy: d.energy,
    summary: d.summary,
  }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis
          dataKey="date"
          tickFormatter={(v) => format(parseISO(v), 'M/d')}
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          interval="preserveStartEnd"
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={[1, 10]}
          ticks={[1, 5, 10]}
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={5} stroke="#e5e7eb" strokeDasharray="4 4" />
        <Line
          type="monotone"
          dataKey="mood"
          name="mood"
          stroke="#a78bfa"
          strokeWidth={2}
          dot={{ r: 3, fill: '#a78bfa', strokeWidth: 0 }}
          activeDot={{ r: 5 }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="energy"
          name="energy"
          stroke="#34d399"
          strokeWidth={2}
          dot={{ r: 3, fill: '#34d399', strokeWidth: 0 }}
          activeDot={{ r: 5 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
