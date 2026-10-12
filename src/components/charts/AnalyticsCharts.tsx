"use client"

import { cn } from "@/lib/utils"

// 1. SemiCircular Gauge
export function SemiCircleGauge({ percentage, size = 180 }: { percentage: number | null, size?: number }) {
  const validPct = percentage === null || isNaN(percentage as number) ? 0 : percentage
  const radius = 80
  const circumference = Math.PI * radius
  const offset = circumference - (validPct / 100) * circumference
  const color = validPct >= 90 ? '#16A34A' : validPct >= 75 ? '#2878B8' : validPct >= 60 ? '#E9A34A' : validPct >= 50 ? '#C62828' : '#858B95'
  const label = validPct >= 90 ? 'التميز' : validPct >= 75 ? 'التقدم' : validPct >= 60 ? 'الانطلاق' : validPct >= 50 ? 'التهيئة' : 'غير مقيم'

  return (
    <div className="relative flex flex-col items-center" style={{ width: size, height: (size * 100 / 180) + 40 }}>
      <svg 
        width={size} 
        height={(size * 100) / 180} 
        viewBox="0 0 180 100" 
        className="overflow-visible"
      >
        {/* تم تعديل إحداثيات القوس ليتوسط الـ viewBox مع هامش آمن لسمك الخط */}
        <path d="M 10 90 A 80 80 0 0 1 170 90" fill="none" stroke="#E2E8F0" strokeWidth="12" strokeLinecap="round" />
        <path 
          d="M 10 90 A 80 80 0 0 1 170 90" 
          fill="none" 
          stroke={color} 
          strokeWidth="12" 
          strokeLinecap="round" 
          strokeDasharray={circumference} 
          strokeDashoffset={offset} 
          style={{ transition: 'stroke-dashoffset 1s ease' }} 
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-2 text-center">
        <span className="text-3xl font-bold text-slate-800">{validPct}%</span>
        <p className="text-sm font-bold mt-1" style={{ color }}>{label}</p>
      </div>
    </div>
  )
}

// 2. Donut Chart (Performance Distribution)
export function DonutChart({ data }: { data: { label: string, value: number, color: string }[] }) {
  const total = data.reduce((acc, curr) => acc + curr.value, 0)
  let cumulativePercentage = 0

  return (
    <div className="flex items-center gap-6">
      <div className="relative w-40 h-40">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          {data.map((segment, i) => {
            const percentage = total > 0 ? (segment.value / total) * 100 : 0
            const dashArray = `${percentage} ${100 - percentage}`
            const dashOffset = -cumulativePercentage
            cumulativePercentage += percentage
            return (
              <circle
                key={i}
                cx="18" cy="18" r="15.9155"
                fill="transparent"
                stroke={segment.color}
                strokeWidth="3.5"
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
              />
            )
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-slate-800">{total}</span>
          <span className="text-xs text-slate-400">إجمالي</span>
        </div>
      </div>
      <div className="space-y-2">
        {data.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }}></span>
            <span className="text-xs text-slate-600">{item.label}</span>
            <span className="text-xs font-bold text-slate-900 mr-auto">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// 3. Vertical Bar Chart (Domain Comparison)
export function VerticalBarChart({ data }: { data: { name: string, percentage: number | null }[] }) {
  return (
    <div className="flex justify-around items-end h-48 gap-4 pt-4">
      {data.map((d, i) => {
        const pct = d.percentage === null || isNaN(d.percentage as number) ? 0 : d.percentage
        const color = pct >= 90 ? '#16A34A' : pct >= 75 ? '#2878B8' : pct >= 60 ? '#E9A34A' : pct >= 50 ? '#C62828' : '#858B95'
        return (
          <div key={i} className="flex flex-col items-center gap-2 w-1/4 h-full justify-end">
            <span className="text-sm font-bold text-slate-900">{pct}%</span>
            <div className="w-full rounded-t-lg transition-all duration-700" style={{ height: `${pct}%`, backgroundColor: color, minHeight: '4px' }}></div>
            <span className="text-[11px] text-slate-500 text-center truncate w-full">{d.name}</span>
          </div>
        )
      })}
    </div>
  )
}

// 4. Horizontal Bar Chart (School Comparison)
export function HorizontalBarChart({ data }: { data: { name: string, percentage: number | null }[] }) {
  return (
    <div className="space-y-3">
      {data.map((d, i) => {
        const pct = d.percentage === null || isNaN(d.percentage as number) ? 0 : d.percentage
        const color = pct >= 90 ? '#16A34A' : pct >= 75 ? '#2878B8' : pct >= 60 ? '#E9A34A' : pct >= 50 ? '#C62828' : '#858B95'
        return (
          <div key={i}>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-medium text-slate-700 truncate">{d.name}</span>
              <span className="font-bold text-slate-900">{pct}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }}></div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// 5. Performance Legend
export function PerformanceLegend() {
  const levels = [
    { label: 'التميز', color: '#16A34A' },
    { label: 'التقدم', color: '#2878B8' },
    { label: 'الانطلاق', color: '#E9A34A' },
    { label: 'التهيئة', color: '#C62828' },
    { label: 'غير مقيم', color: '#858B95' },
  ]
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
      {levels.map((l, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: l.color }}></span>
          <span className="text-xs text-slate-600">{l.label}</span>
        </div>
      ))}
    </div>
  )
}