// ===== FILE: src/app/(school-manager)/school-manager/users/add/page.tsx =====
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { StageChecklist } from "@/components/ui/StageChecklist"
import { createUser } from "@/features/admin/actions"
import { Loader2, Save } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"

// الأدوار التي يظهر لها حقل تعيين المراحل التعليمية (مطابق لفرض الخادم في createUser)
const STAGE_ASSIGNABLE_ROLES = ["BRANCH_MANAGER", "QUALITY_ASSESSOR"]

export default function AddUserPage({ searchParams }: { searchParams: { role?: string } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // تحديد الأدوار بناءً على الرابط الذي تم الدخول منه
  const userRole = searchParams.role === "BRANCH_MANAGER" ? "BRANCH_MANAGER" : "SCHOOL_MANAGER"
  
  const allowedRoles = userRole === "SCHOOL_MANAGER" 
    ? [{ value: "BRANCH_MANAGER", label: "مدير قسم" }, { value: "QUALITY_ASSESSOR", label: "مشرف" }]
    : [{ value: "QUALITY_ASSESSOR", label: "مشرف" }]

  // الدور المختار — يتحكم في ظهور/إخفاء قائمة المراحل التعليمية
  const [selectedRole, setSelectedRole] = useState(allowedRoles[0].value)
  const showStageChecklist = STAGE_ASSIGNABLE_ROLES.includes(selectedRole)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    const formData = new FormData(e.currentTarget)
    const res = await createUser(formData)
    
    if (res?.error) {
      setError(res.error)
      setLoading(false)
    } else if (res?.success) {
      router.push("/school-manager/users")
      router.refresh()
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title={userRole === "BRANCH_MANAGER" ? "إضافة مشرف" : "إضافة مستخدم"}
        description="أدخل بيانات المستخدم الجديد."
        breadcrumbs={[{ label: 'الرئيسية', href: '/school-manager' }, { label: 'المستخدمون', href: '/school-manager/users' }, { label: 'إضافة' }]}
      />

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="p-3 bg-danger/10 text-danger rounded-lg text-sm">{error}</div>}
            
            <div className="space-y-1.5">
              <label className="text-sm font-medium">الاسم الكامل</label>
              <Input name="name" required />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">البريد الإلكتروني</label>
              <Input name="email" type="email" required />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">كلمة المرور</label>
              <Input name="password" type="password" required placeholder="6 أحرف على الأقل" />
            </div>

            {allowedRoles.length > 1 ? (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">الدور</label>
                <Select
                  name="role"
                  value={selectedRole}
                  onValueChange={v => setSelectedRole(v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="اختر الدور" />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedRoles.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <input type="hidden" name="role" value={allowedRoles[0].value} />
            )}

            {/* قائمة المراحل التعليمية (اختيار متعدد) — لمديري الأقسام والمقيّمين فقط.
                التحقق النهائي دائمًا على الخادم في createUser */}
            {showStageChecklist && <StageChecklist />}

            {/* حقل اختيار الفرع يظهر فقط لالمدير العام، أما مدير قسم فيتم ربطه تلقائياً في الخادم */}
            {userRole === "SCHOOL_MANAGER" && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">الفرع</label>
                <Select name="branchId" required>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="اختر الفرع" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* سيتم تحميل الفروع ديناميكياً إذا أردت، أو يمكنك تمريرها كـ props */}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="ghost" onClick={() => router.back()}>إلغاء</Button>
              <Button type="submit" disabled={loading} icon={loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}>
                {loading ? "جاري الحفظ..." : "حفظ المستخدم"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}