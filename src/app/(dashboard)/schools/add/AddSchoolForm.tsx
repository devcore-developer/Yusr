"use client"
import * as React from "react"
import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Textarea } from "@/components/ui/Textarea"
import { Select } from "@/components/ui/Select"
import { AlertTriangle } from "lucide-react"
import { createSchoolAction } from "./actions"

export function AddSchoolForm() {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(
    async (_prev: any, formData: FormData) => {
      try {
        await createSchoolAction(formData)
      } catch (e: any) {
        return { error: e.message }
      }
    },
    null
  )

  return (
    <form action={formAction} className="space-y-6 max-w-4xl">
      <PageHeader
        title="إضافة مدرسة جديدة"
        description="سجّل مدرسة جديدة في المنصة مع تفعيل اشتراكها."
        breadcrumbs={[{ label: 'الرئيسية', href: '/' }, { label: 'المدارس', href: '/schools' }, { label: 'إضافة مدرسة' }]}
        actions={
          <Button type="button" variant="outline" onClick={() => router.back()}>
            إلغاء
          </Button>
        }
      />

      {state?.error && (
        <div className="flex items-center gap-3 p-3 bg-danger/5 border border-danger/20 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-danger shrink-0" />
          <p className="text-sm text-danger">{state.error}</p>
        </div>
      )}

      {/* School Info */}
      <Card>
        <CardHeader>
          <CardTitle>معلومات المدرسة</CardTitle>
          <CardDescription>البيانات الأساسية للمدرسة كما ستظهر في المنصة</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FormField label="اسم المدرسة" required>
            <Input name="name" required placeholder="مثال: مدارس المستقبل الأهلية" />
          </FormField>
          <FormField label="الموقع" required>
            <Input name="location" required placeholder="المدينة - الحي" />
          </FormField>
          <div className="md:col-span-2">
            <FormField label="وصف المدرسة">
              <Textarea name="description" placeholder="نبذة مختصرة عن المدرسة..." />
            </FormField>
          </div>
        </CardContent>
      </Card>

      {/* Contact Info */}
      <Card>
        <CardHeader>
          <CardTitle>معلومات الاتصال</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FormField label="رقم الهاتف" required>
            <Input name="phone" required type="tel" placeholder="+9665XXXXXXXX" />
          </FormField>
          <FormField label="البريد الإلكتروني" required>
            <Input name="email" required type="email" placeholder="info@school.sch" />
          </FormField>
        </CardContent>
      </Card>

      {/* Subscription */}
      <Card>
        <CardHeader>
          <CardTitle>الاشتراك</CardTitle>
          <CardDescription>سيتم تفعيل الاشتراك فور إنشاء المدرسة</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <FormField label="الباقة">
            <Select name="plan" defaultValue="Pro">
              <option value="Basic">أساسية</option>
              <option value="Pro">احترافية</option>
              <option value="Enterprise">مؤسسات</option>
            </Select>
          </FormField>
          <div className="md:col-span-2 flex items-end">
            <p className="text-[13px] text-muted-foreground">
              مدة الاشتراك الافتراضية: سنة واحدة من تاريخ الإنشاء.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>إلغاء</Button>
        <Button type="submit" loading={isPending}>حفظ المدرسة</Button>
      </div>
    </form>
  )
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground-strong">
        {label}
        {required && <span className="text-danger mr-1">*</span>}
      </label>
      {children}
    </div>
  )
}