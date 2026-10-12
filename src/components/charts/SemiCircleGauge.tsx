interface GaugeProps {
  percentage: number | null
  size?: number
}

export function SemiCircleGauge({ percentage, size = 180 }: GaugeProps) {
  const validPct = percentage === null || isNaN(percentage as number) ? 0 : percentage
  const radius = 80
  const circumference = Math.PI * radius // Half circle
  const offset = circumference - (validPct / 100) * circumference

  // Dynamic import or inline style for color to avoid circular deps
  const color = validPct >= 90 ? '#16A34A' : validPct >= 75 ? '#2878B8' : validPct >= 60 ? '#E9A34A' : validPct >= 50 ? '#C62828' : '#858B95'
  const label = validPct >= 90 ? 'التميز' : validPct >= 75 ? 'التقدم' : validPct >= 60 ? 'الانطلاق' : validPct >= 50 ? 'التهيئة' : 'غير مقيم'

  return (
    <div className="flex flex-col items-center justify-center" style={{ width: size }}>
      <svg width={size} height={size / 2} viewBox="0 0 180 90">
        <path
          d="M 10 80 A 80 80 0 0 1 170 80"
          fill="none"
          stroke="#E2E8F0"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M 10 80 A 80 80 0 0 1 170 80"
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div className="-mt-12 text-center">
        <span className="text-3xl font-bold text-slate-800">{validPct}%</span>
        <p className="text-sm font-bold mt-1" style={{ color }}>{label}</p>
      </div>
    </div>
  )
}