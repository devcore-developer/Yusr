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