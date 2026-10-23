// ===== FILE: src/components/admin/EditUserModal.tsx =====
"use client"

// ============================================================
// EditUserModal — تعديل حساب قائم (الإدارة) + تعيين المراحل التعليمية
// (هذه المهمة): يغلق فجوة تعديل الحسابات القائمة — كانت الخادمية جاهزة
// (adminUpdateUser) والواجهة ناقصة.
//
// ما يعدّله (مطابق لقدرات الخادم حرفيًا — لا أكثر):
//   - الاسم والبريد الإلكتروني.
//   - الدور (يظهر لمدير النظام فقط، وخياراته مدير قسم/مشرف — الخادم يفرض ذلك).
//   - المراحل التعليمية (قائمة StageChecklist القائمة) — تظهر للأدوار
//     القابلة للتعيين (مدير قسم/مشرف) — تُقرأ formData.getAll("stages")
//     على الخادم، والنماذج بلا قائمة لا تمس التعيينات (توافق خلفي آمن).
//
// الصلاحيات يفرضها الخادم في adminUpdateUser حصرًا:
//   SA أي مستخدم (عدا مديري النظام) / SM مستخدمي مدرسته / BM مشرفي فروعه
//   المصرح بها فقط — ما يظهر هنا مجرد انعكاس، والتحقق النهائي خادمي.
// لا يمس: كلمة المرور، الحالة، المدرسة/الفرع، ولا أي سجلات أخرى.
// ============================================================

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Modal } from "@/components/ui/Modal"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { StageChecklist } from "@/components/ui/StageChecklist"
import { adminUpdateUser } from "@/features/admin/actions"
import { Pencil, Loader2, AlertTriangle } from "lucide-react"

interface EditUserModalProps {
  user: {
    id: string
    name: string | null
    email: string | null
    role: string
    stages?: string[] | null
  }
  currentUserRole: string
}

// الأدوار التي تدعم تعيين المراحل — مطابقة لفرض الخادم في adminUpdateUser
const STAGE_ASSIGNABLE_ROLES = ["BRANCH_MANAGER", "QUALITY_ASSESSOR"]

export function EditUserModal({ user, currentUserRole }: EditUserModalProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  // الدور المختار — يتحكم في ظهور قائمة المراحل (نفس نمط صفحة إضافة المستخدم)
  const [selectedRole, setSelectedRole] = useState<string>(user.role)
  const showStages = STAGE_ASSIGNABLE_ROLES.includes(selectedRole)
  const canEditRole = currentUserRole === "SUPER_ADMIN"

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSaved(false)
    const fd = new FormData(e.currentTarget)
    try {
      const res = await adminUpdateUser(user.id, fd) as { success?: boolean; error?: string }
      if (res?.error) {
        setError(res.error)
      } else {
        setSaved(true)
        setIsOpen(false)
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ أثناء تحديث بيانات المستخدم")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="تعديل"
        onClick={() => { setError(null); setSaved(false); setSelectedRole(user.role); setIsOpen(true) }}
        icon={<Pencil className="w-4 h-4" />}
      />

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={`تعديل حساب: ${user.name ?? user.email ?? ""}`}
        description="تحديث بيانات الحساب والمراحل التعليمية المصرح بها — التحقق النهائي على الخادم."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-foreground-strong">الاسم الكامل</label>
              <Input name="name" defaultValue={user.name ?? ""} required />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-foreground-strong">البريد الإلكتروني</label>
              <Input name="email" type="email" defaultValue={user.email ?? ""} required />
            </div>
          </div>

          {canEditRole ? (
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-foreground-strong">الدور</label>
              <select
                value={selectedRole}
                onChange={e => setSelectedRole(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground-strong focus:outline-none focus:ring-2 focus:ring-primary/40"
                aria-label="الدور"
              >
                {user.role === "SCHOOL_MANAGER" && <option value="SCHOOL_MANAGER">مدير عام (بدون تغيير)</option>}
                <option value="BRANCH_MANAGER">مدير قسم</option>
                <option value="QUALITY_ASSESSOR">مشرف (مقيّم جودة)</option>
              </select>
              <p className="text-[11px] text-muted-foreground">
                تغيير الدور مسموح لمدير النظام فقط — والخادم يرفض أي قيمة غير مصرح بها.
              </p>
            </div>
          ) : (
            <input type="hidden" name="role" value={user.role} />
          )}

          {/* قائمة المراحل — تظهر للنوع القابل للتعيين فقط؛ إرسالها يُحدّث التعيينات
              (قائمة فارغة = مسح الكل — سلوك مقصود موثق في الخادم)،
              وعدم إرسالها (الأدوار الأخرى) يُبقي التعيينات كما هي. */}
          {showStages ? (
            <StageChecklist defaultSelected={(user.stages ?? []) as string[]} />
          ) : (
            <p className="text-[12px] text-muted-foreground bg-surface-muted rounded-lg p-3">
              حسابات {selectedRole === "SUPER_ADMIN" ? "مدير النظام" : selectedRole === "SCHOOL_MANAGER" ? "المدير العام" : "هذا الدور"} غير مقيّدة بمراحل محددة — تعمل في جميع المراحل التعليمية الخمس.
            </p>
          )}

          {error && (
            <div className="flex items-start gap-2 text-[13px] text-[#dc2626] bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>إلغاء</Button>
            <Button type="submit" variant="primary" disabled={loading} icon={loading ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}>
              {loading ? "جارٍ الحفظ..." : "حفظ التغييرات"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}