"use client"

import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Modal } from "@/components/ui/Modal"
import { Input } from "@/components/ui/Input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select"
import { createUser } from "@/features/admin/actions"
import { UserPlus, Loader2 } from "lucide-react"

interface Branch {
  id: string
  name: string
}

export function AddUserModal({ userRole, branches }: { userRole: string, branches: Branch[] }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const allowedRoles = userRole === "SCHOOL_MANAGER" 
    ? [{ value: "BRANCH_MANAGER", label: "مدير فرع" }, { value: "QUALITY_ASSESSOR", label: "مشرف" }]
    : userRole === "BRANCH_MANAGER"
    ? [{ value: "QUALITY_ASSESSOR", label: "مشرف" }] // مشرف فقط
    : [
        { value: "SCHOOL_MANAGER", label: "مدير مدرسة" },
        { value: "BRANCH_MANAGER", label: "مدير فرع" },
        { value: "QUALITY_ASSESSOR", label: "مشرف" }
      ]

  const handleSubmit = async (formData: FormData) => {
    setIsLoading(true)
    setError("")
    const res = await createUser(formData)
    if (res?.error) {
      setError(res.error)
    } else if (res?.success) {
      setIsOpen(false)
    }
    setIsLoading(false)
  }

  return (
    <>
      {/* تغيير نص الزر حسب الدور */}
      <Button variant="primary" size="md" icon={<UserPlus className="w-4 h-4" />} onClick={() => setIsOpen(true)}>
        {userRole === "BRANCH_MANAGER" ? "إضافة مشرف" : "إضافة مستخدم"}
      </Button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={userRole === "BRANCH_MANAGER" ? "إنشاء حساب مشرف" : "إنشاء حساب مستخدم جديد"}>
        <form action={handleSubmit} className="space-y-4">
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

          {/* إظهار حقل الدور فقط إذا كان هناك أكثر من خيار (أي ليس مدير قسم) */}
          {allowedRoles.length > 1 ? (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">الدور</label>
              <Select name="role" defaultValue={allowedRoles[0].value}>
                <SelectTrigger className="w-full"><SelectValue placeholder="اختر الدور" /></SelectTrigger>
                <SelectContent>
                  {allowedRoles.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <input type="hidden" name="role" value={allowedRoles[0].value} />
          )}

          {/* إظهار قائمة الفروع لالمدير العام فقط */}
          {userRole === "SCHOOL_MANAGER" && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">الفرع</label>
              <Select name="branchId" required>
                <SelectTrigger className="w-full"><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                <SelectContent>
                  {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* حقول مخفية لمدير قسم ليتم ربط المقيّم بفرعه تلقائياً */}
          {userRole === "BRANCH_MANAGER" && (
            <input type="hidden" name="branchId" value={branches[0]?.id || ""} />
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>إلغاء</Button>
            <Button type="submit" disabled={isLoading} icon={isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}>
              {isLoading ? "جاري الإنشاء..." : "إنشاء الحساب"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}