"use client"

import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Textarea } from "@/components/ui/Textarea"
import { Select } from "@/components/ui/Select"
import { savePlan } from "../actions"
import { Loader2, Save, PlusCircle, Trash2 } from "lucide-react"

interface PlanFormProps {
  plan?: any
  gap?: any
}

export function PlanForm({ plan, gap }: PlanFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actions, setActions] = useState<any[]>(
    plan?.actions?.length > 0 ? plan.actions : [{ title: "", status: "PENDING", startDate: "", dueDate: "" }]
  )

  const handleAddAction = () => {
    setActions([...actions, { title: "", status: "PENDING", startDate: "", dueDate: "" }])
  }

  const handleRemoveAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    const formData = new FormData(e.currentTarget)
    // إضافة مصفوفة الإجراءات إلى الـ FormData
    actions.forEach((action, index) => {
      formData.set(`actions[${index}][title]`, action.title)
      formData.set(`actions[${index}][status]`, action.status)
      formData.set(`actions[${index}][startDate]`, action.startDate)
      formData.set(`actions[${index}][dueDate]`, action.dueDate)
    })

    try {
      await savePlan(formData)
      window.location.href = "/school-manager/quality/improvement-plans"
    } catch (err: any) {
      setError(err.message)
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && <div className="p-3 bg-danger/10 text-danger rounded-lg text-sm">{error}</div>}
      <input type="hidden" name="id" defaultValue={plan?.id} />
      <input type="hidden" name="gapId" defaultValue={gap?.id || plan?.gapId} />
      <input type="hidden" name="indicatorId" defaultValue={gap?.indicatorId || plan?.indicatorId} />

      {/* القسم أ: بيانات الخطة */}
      <div className="space-y-4 p-4 border border-border rounded-lg">
        <h3 className="text-lg font-bold text-foreground-strong">بيانات الخطة</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-medium">عنوان الخطة <span className="text-danger">*</span></label>
            <Input name="title" required defaultValue={plan?.title || (gap ? `خطة معالجة فجوة ${gap.indicator.code}` : "")} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">تاريخ البدء</label>
            <Input name="startDate" type="date" defaultValue={plan?.startDate ? new Date(plan.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">تاريخ الانتهاء المستهدف <span className="text-danger">*</span></label>
            <Input name="targetDate" type="date" required defaultValue={plan?.targetDate ? new Date(plan.targetDate).toISOString().split('T')[0] : ""} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">الأولوية</label>
            <Select name="priority" defaultValue={plan?.priority || "MEDIUM"}>
              <option value="HIGH">عالية</option>
              <option value="MEDIUM">متوسطة</option>
              <option value="LOW">منخفضة</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">الحالة</label>
            <Select name="status" defaultValue={plan?.status || "DRAFT"}>
              <option value="DRAFT">مسودة</option>
              <option value="ACTIVE">جارية</option>
              <option value="COMPLETED">مكتملة</option>
            </Select>
          </div>
        </div>
      </div>

      {/* القسم ب: تحليل الأداء */}
      <div className="space-y-4 p-4 border border-border rounded-lg">
        <h3 className="text-lg font-bold text-foreground-strong">تحليل الأداء الحالي</h3>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">أسباب الأداء الحالي</label>
          <Textarea name="reasons" rows={2} defaultValue={plan?.reasons} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">نقاط القوة</label>
            <Textarea name="strengths" rows={2} defaultValue={plan?.strengths} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">جوانب التحسين</label>
            <Textarea name="improvements" rows={2} defaultValue={plan?.improvements} />
          </div>
        </div>
      </div>

      {/* القسم ج: مؤشرات الأداء (KPIs) */}
      <div className="space-y-4 p-4 border border-border rounded-lg">
        <h3 className="text-lg font-bold text-foreground-strong">مؤشرات النجاح (KPIs)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">النسبة الأساسية (%)</label>
            <Input name="baseline" type="number" min="0" max="100" defaultValue={plan?.baseline} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">النسبة المستهدفة (%)</label>
            <Input name="targetPercentage" type="number" min="0" max="100" defaultValue={plan?.targetPercentage} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">النسبة المقاسة حالياً (%)</label>
            <Input name="currentMeasured" type="number" min="0" max="100" defaultValue={plan?.currentMeasured} />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">معايير النجاح المتوقعة</label>
          <Input name="successCriteria" defaultValue={plan?.successCriteria} />
        </div>
      </div>

      {/* القسم د: إجراءات التحسين */}
      <div className="space-y-4 p-4 border border-border rounded-lg">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-foreground-strong">إجراءات التحسين</h3>
          <Button type="button" variant="outline" size="sm" icon={<PlusCircle className="w-4 h-4" />} onClick={handleAddAction}>
            إضافة إجراء
          </Button>
        </div>
        
        <div className="space-y-4">
          {actions.map((action, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end p-3 bg-surface-muted/30 rounded-lg">
              <div className="md:col-span-5 space-y-1">
                <label className="text-xs font-medium">وصف الإجراء</label>
                <Input 
                  value={action.title} 
                  onChange={(e) => {
                    const newActions = [...actions]
                    newActions[index].title = e.target.value
                    setActions(newActions)
                  }} 
                  required 
                />
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-medium">تاريخ البدء</label>
                <Input 
                  type="date" 
                  value={action.startDate}
                  onChange={(e) => {
                    const newActions = [...actions]
                    newActions[index].startDate = e.target.value
                    setActions(newActions)
                  }}
                />
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-medium">تاريخ الانتهاء</label>
                <Input 
                  type="date" 
                  value={action.dueDate}
                  onChange={(e) => {
                    const newActions = [...actions]
                    newActions[index].dueDate = e.target.value
                    setActions(newActions)
                  }}
                />
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-medium">الحالة</label>
                <Select 
                  value={action.status}
                  onChange={(e) => {
                    const newActions = [...actions]
                    newActions[index].status = e.target.value
                    setActions(newActions)
                  }}
                >
                  <option value="PENDING">لم يبدأ</option>
                  <option value="IN_PROGRESS">جارية</option>
                  <option value="COMPLETED">مكتملة</option>
                  <option value="DELAYED">متعثرة</option>
                </Select>
              </div>
              <div className="md:col-span-1 flex justify-center">
                <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveAction(index)}>
                  <Trash2 className="w-4 h-4 text-danger" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* القسم هـ: الدعم والمتابعة */}
      <div className="space-y-4 p-4 border border-border rounded-lg">
        <h3 className="text-lg font-bold text-foreground-strong">الدعم والمتابعة</h3>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">الدعم والموارد المطلوبة</label>
          <Textarea name="requiredSupport" rows={2} defaultValue={plan?.requiredSupport} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">منهجية المتابعة وقياس الأثر</label>
          <Textarea name="followUpMethod" rows={2} defaultValue={plan?.followUpMethod} />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="submit" disabled={loading} icon={loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}>
          {loading ? "جاري الحفظ..." : "حفظ الخطة"}
        </Button>
      </div>
    </form>
  )
}