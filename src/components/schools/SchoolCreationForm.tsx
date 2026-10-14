"use client"

import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Textarea } from "@/components/ui/Textarea"
import { Select } from "@/components/ui/Select"
import { createSchoolWithManager } from "@/app/(dashboard)/schools/actions"
import { Building2, Upload, Loader2, CheckCircle, Copy, Printer } from "lucide-react"
import { Modal } from "@/components/ui/Modal"

export function SchoolCreationForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [successData, setSuccessData] = useState<any | null>(null)

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = () => setLogoPreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    const formData = new FormData(e.currentTarget)
    try {
      const result = await createSchoolWithManager(formData)
      if (result.success) {
        setSuccessData(result)
        e.currentTarget.reset()
        setLogoPreview(null)
      }
    } catch (err: any) {
      setError(err.message)
    }
    setLoading(false)
  }

  const copyCredentials = () => {
    if (!successData) return
    const text = `اسم المدرسة: ${successData.schoolName}\nكود المدرسة: ${successData.schoolCode}\nبريد المدير: ${successData.managerEmail}\nكلمة المرور: ${successData.managerPassword}`
    navigator.clipboard.writeText(text)
    alert("تم نسخ البيانات بنجاح")
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div className="p-4 bg-danger/10 text-danger rounded-lg text-sm">{error}</div>
        )}

        {/* القسم أ: بيانات المدرسة الأساسية */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-foreground-strong border-r-4 border-primary pr-3">بيانات المدرسة الأساسية</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-medium">اسم المدرسة (عربي) <span className="text-danger">*</span></label>
              <Input name="name" required placeholder="مثال: مدارس المستقبل الأهلية" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">اسم المدرسة (إنجليزي)</label>
              <Input name="nameEn" placeholder="Future Schools" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">كود المدرسة</label>
              <Input name="schoolCode" placeholder="SCH-001" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">المرحلة التعليمية</label>
              <Select name="educationalStage">
                <option value="متعدد المراحل">متعدد المراحل</option>
                <option value="رياض أطفال">رياض أطفال</option>
                <option value="ابتدائي">ابتدائي</option>
                <option value="إعدادي">إعدادي</option>
                <option value="ثانوي">ثانوي</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">نوع المدرسة</label>
                <Select name="schoolType">
                <option value="أهلية">أهلية</option>
                <option value="حكومية">حكومية</option>
                <option value="دولية">دولية</option>
                </Select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-medium">شعار المدرسة</label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-surface-muted">
                  {logoPreview ? <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" /> : <Building2 className="w-8 h-8 text-muted-foreground" />}
                </div>
                <label className="cursor-pointer">
                  <span className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-md text-sm font-medium hover:bg-surface-muted">
                    <Upload className="w-4 h-4" /> اختر شعار
                  </span>
                  <input type="file" name="logo" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleLogoChange} />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* القسم ب: بيانات التواصل */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-foreground-strong border-r-4 border-primary pr-3">بيانات التواصل</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">البريد الإلكتروني الرسمي للمدرسة</label>
              <Input name="officialEmail" type="email" placeholder="info@school.com" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">رقم الهاتف</label>
              <Input name="phone" placeholder="+9665..." />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">المدينة</label>
              <Input name="city" placeholder="الرياض" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">العنوان</label>
              <Input name="address" placeholder="حي النخيل - شارع الملك" />
            </div>
          </div>
        </div>

        {/* القسم ج: بيانات المدير العام */}
        <div className="space-y-4 p-4 bg-surface-muted/30 rounded-lg">
          <h3 className="text-lg font-bold text-foreground-strong border-r-4 border-secondary pr-3">حساب المدير العام</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">اسم المدير العام <span className="text-danger">*</span></label>
              <Input name="managerName" required placeholder="أحمد محمد" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">بريد الدخول (للمدير) <span className="text-danger">*</span></label>
              <Input name="managerEmail" type="email" required placeholder="manager@school.com" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">كلمة المرور <span className="text-danger">*</span></label>
              <Input name="managerPassword" type="password" required placeholder="******" />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={loading} icon={loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}>
            {loading ? "جاري الإنشاء..." : "حفظ وإنشاء المدرسة"}
          </Button>
        </div>
      </form>

      {/* نافذة نجاح الإنشاء وتسليم البيانات */}
      <Modal isOpen={!!successData} onClose={() => setSuccessData(null)} title="تم إنشاء المدرسة بنجاح" description="يمكنك تسليم هذه البيانات لالمدير العام">
        {successData && (
          <div className="space-y-4">
            <div className="p-4 bg-surface-muted rounded-lg space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">اسم المدرسة:</span> <span className="font-bold text-foreground-strong">{successData.schoolName}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">كود المدرسة:</span> <span className="font-bold text-foreground-strong">{successData.schoolCode}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">بريد الدخول:</span> <span className="font-bold text-foreground-strong">{successData.managerEmail}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">كلمة المرور:</span> <span className="font-bold text-danger">{successData.managerPassword}</span></div>
            </div>
            <p className="text-xs text-muted-foreground">تنبيه: احتفظ بكلمة المرور في مكان آمن. لن يتمكن النظام من استعادتها لاحقاً.</p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" icon={<Printer className="w-4 h-4" />} onClick={() => window.print()}>طباعة</Button>
              <Button icon={<Copy className="w-4 h-4" />} onClick={copyCredentials}>نسخ البيانات</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}