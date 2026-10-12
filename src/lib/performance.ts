export interface PerformanceLevel {
  label: string
  color: string
  level: number
}

export function getPerformanceLevel(percentage: number | null | undefined): PerformanceLevel {
  if (percentage === null || percentage === undefined || isNaN(percentage as number)) {
    return { label: 'غير مقيم', color: '#858B95', level: 0 }
  }
  if (percentage >= 90) return { label: 'التميز', color: '#16A34A', level: 4 }
  if (percentage >= 75) return { label: 'التقدم', color: '#2878B8', level: 3 }
  if (percentage >= 60) return { label: 'الانطلاق', color: '#E9A34A', level: 2 }
  if (percentage >= 50) return { label: 'التهيئة', color: '#C62828', level: 1 }
  return { label: 'غير مقيم', color: '#858B95', level: 0 }
}