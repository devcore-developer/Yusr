interface DomainData {
  name: string
  percentage: number | null
}

export function DomainBarChart({ domains }: { domains: DomainData[] }) {
  return (
    <div className="space-y-4 w-full">
      {domains.map((domain, i) => {
        const validPct = domain.percentage === null || isNaN(domain.percentage as number) ? 0 : domain.percentage
        const color = validPct >= 90 ? '#16A34A' : validPct >= 75 ? '#2878B8' : validPct >= 60 ? '#E9A34A' : validPct >= 50 ? '#C62828' : '#858B95'
        
        return (
          <div key={i}>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-medium text-slate-700">{domain.name}</span>
              <span className="font-bold text-slate-900">{validPct}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${validPct}%`, backgroundColor: color }}
              ></div>
            </div>
          </div>
        )
      })}
    </div>
  )
}