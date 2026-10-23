// ============================================================
// شارة العام الدراسي — عرض موحّد في لوحات التحكم والتقارير
// مكون عرضي صرف (بلا حالة وبلا استيرادات خادمية) — يعمل في أي سياق.
// الصيغة الموحدة: «العام الدراسي 1448–1449 هـ»
// السجلات بلا عام مخزّن تظهر «غير محدد» — لا اختراع لارتباط تاريخي.
// ============================================================

import { Badge } from "@/components/ui/Badge"

export function AcademicYearBadge({
  year,
  className
}: {
  year: { label: string } | null | undefined
  className?: string
}) {
  if (year?.label) {
    return (
      <Badge variant="info" dot className={className}>
        العام الدراسي {year.label}
      </Badge>
    )
  }
  return (
    <Badge variant="neutral" className={className}>
      العام الدراسي: غير محدد
    </Badge>
  )
}