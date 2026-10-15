"use client"
import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Modal } from "@/components/ui/Modal"
import { Input } from "@/components/ui/Input"
import { updateSchool } from "@/features/admin/actions"
import { Pencil, Loader2 } from "lucide-react"

export function EditSchoolModal({ school }: { school: any }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (formData: FormData) => {
    setIsLoading(true); setError("")
    const res = await updateSchool(school.id, formData)
    if (res?.error) setError(res.error)
    else setIsOpen(false)
    setIsLoading(false)
  }

  return (
    <>
      <Button variant="ghost" size="icon-sm" className="text-secondary" onClick={() => setIsOpen(true)}>
        <Pencil className="w-4 h-4" />
      </Button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={`تعديل مدرسة: ${school.name}`}>
        <form action={handleSubmit} className="space-y-4">
          {error && <div className="p-3 bg-danger/10 text-danger rounded-lg text-sm mb-4">{error}</div>}
          
          <div className="space-y-1.5">
            <label className="text-sm font-medium">اسم المدرسة</label>
            <Input name="name" defaultValue={school.name} required />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">الموقع</label>
            <Input name="location" defaultValue={school.location} required />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">رقم الهاتف</label>
            <Input name="phone" defaultValue={school.phone || ""} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">رابط الشعار (Logo URL)</label>
            <Input name="logoUrl" defaultValue={school.logoUrl || ""} placeholder="https://..." />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>إلغاء</Button>
            <Button type="submit" disabled={isLoading} icon={isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}>
              حفظ التعديلات
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}