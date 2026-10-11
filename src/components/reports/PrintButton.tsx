"use client"

export function PrintButton() {
  return (
    <button 
      onClick={() => window.print()} 
      className="px-4 py-2 bg-primary text-white rounded-md no-print mb-8"
    >
      طباعة / حفظ كـ PDF
    </button>
  )
}