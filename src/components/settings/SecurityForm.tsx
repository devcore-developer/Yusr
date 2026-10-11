"use client"

import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { updatePassword } from "@/app/(dashboard)/settings/actions"
import { Loader2, ShieldCheck } from "lucide-react"

export function SecurityForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)
    
    const formData = new FormData(e.currentTarget)
    try {
      await updatePassword(formData)
      setSuccess(true)
      e.currentTarget.reset()
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message)
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="p-3 bg-danger/10 text-danger rounded-lg text-sm">{error}</div>}
      {success && <div className="p-3 bg-success/10 text-success rounded-lg text-sm">تم تحديث كلمة المرور بنجاح.</div>}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">كلمة المرور الجديدة</label>
          <Input name="newPassword" type="password" required placeholder="******" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">تأكيد كلمة المرور</label>
          <Input name="confirmPassword" type="password" required placeholder="******" />
        </div>
      </div>
      
      <div className="flex justify-end">
        <Button type="submit" disabled={loading} icon={loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}>
          {loading ? "جاري الحفظ..." : "تحديث كلمة المرور"}
        </Button>
      </div>
    </form>
  )
}