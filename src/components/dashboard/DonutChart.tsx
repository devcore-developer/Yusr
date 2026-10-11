import { cn } from "@/lib/utils"

interface DonutChartProps {
  centerValue: number | string
  centerLabel?: string
  segments: { label: string; value: number; color: string }[]
  className?: string
}

export function DonutChart({ centerValue, centerLabel, segments, className }: DonutChartProps) {
  const total = segments.reduce((acc, s) => acc + s.value, 0)
  const circumference = 2 * Math.PI * 15.9155 // radius for 36x36 viewBox
  
  let accumulatedOffset = 25 // Start from top

  return (
    <div className={cn("relative w-full max-w-[180px] aspect-square mx-auto", className)}>
      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
        <circle 
          cx="18" cy="18" r="15.9155" 
          fill="none" 
          stroke="hsl(var(--surface-muted))" 
          strokeWidth="3.5" 
        />
        {total > 0 && segments.map((seg, i) => {
          const dash = (seg.value / total) * circumference
          const gap = circumference - dash
          const rotation = (accumulatedOffset / 100) * 360
          
          const circle = (
            <circle
              key={i}
              cx="18" cy="18" r="15.9155"
              fill="none"
              stroke={seg.color}
              strokeWidth="3.5"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={circumference - (accumulatedOffset / 100) * circumference}
              strokeLinecap="round"
              className="transition-all duration-700 ease-smooth"
            />
          )
          
          accumulatedOffset += (seg.value / total) * 100
          return circle
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-bold text-foreground-strong numeric leading-none">{centerValue}</span>
        {centerLabel && <span className="text-[11px] text-muted-foreground mt-1">{centerLabel}</span>}
      </div>
    </div>
  )
}