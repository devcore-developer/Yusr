"use client"
import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Modal } from "@/components/ui/Modal"
import { Input } from "@/components/ui/Input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select"
import { adminUpdateUser, adminResetPassword } from "@/features/admin/actions"
import { Pencil, KeyRound, Loader2 } from "lucide-react"

export function EditUserModal({ user, currentUserRole }: { user: any, currentUserRole: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [tab, setTab] = useState<"info" | "password">("info")
  const [newPassword, setNewPassword] = useState("")

  const handleSubmit = async (formData: FormData) => {
    setIsLoading(true); setError("")
    const res = await adminUpdateUser(user.id, formData)
    if (res?.error) setError(res.error)
    else setIsOpen(false)
    setIsLoading(false)
  }

  const handleResetPassword = async () => {
    setIsLoading(true); setError("")
    const res = await adminResetPassword(user.id, newPassword)
    if (res?.error) setError(res.error)
    else { setIsOpen(false); setNewPassword("") }
    setIsLoading(false)
  }

  return (
    <>
      <Button variant="ghost" size="icon-sm" className="text-secondary" onClick={() => setIsOpen(true)}>
        <Pencil className="w-4 h-4" />
      </Button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={`تعديل حساب: ${user.name}`}>
        <div className="flex gap-2 mb-4 border-b">
          <button className={`p-2 text-sm ${tab === "info" ? "border-b-2 border-primary text-primary" : ""}`} onClick={() => setTab("info")}>البيانات الأساسية</button>
          {currentUserRole === "SUPER_ADMIN" && (
            <button className={`p-2 text-sm ${tab === "password" ? "border-b-2 border-primary text-primary" : ""}`} onClick={() => setTab("password")}>إعادة تعيين كلمة المرور</button>
          )}
        </div>

        {error && <div className="p-3 bg-danger/10 text-danger rounded-lg text-sm mb-4">{error}</div>}

        {tab === "info" ? (
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">الاسم الكامل</label>
              <Input name="name" defaultValue={user.name} required />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">البريد الإلكتروني</label>
              <Input name="email" type="email" defaultValue={user.email} required />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">الدور</label>
              <Select name="role" defaultValue={user.role} disabled={currentUserRole !== "SUPER_ADMIN"}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SCHOOL_MANAGER">مدير عام</SelectItem>
                  <SelectItem value="BRANCH_MANAGER">مدير قسم</SelectItem>
                  <SelectItem value="QUALITY_ASSESSOR">مشرف</SelectItem>
                  {currentUserRole === "SUPER_ADMIN" && <SelectItem value="SUPER_ADMIN">مدير نظام</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={isLoading} icon={isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}>حفظ التعديلات</Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="bg-warning/10 p-3 rounded-lg text-warning text-sm">
              سيتم تغيير كلمة مرور المستخدم فوراً. تأكد من إبلاغه بكلمة المرور الجديدة.
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">كلمة المرور الجديدة</label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="6 أحرف على الأقل" />
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>إلغاء</Button>
              <Button onClick={handleResetPassword} disabled={isLoading || !newPassword} icon={<KeyRound className="w-4 h-4" />}>
                إعادة التعيين
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}