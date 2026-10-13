"use client"

import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Textarea } from "@/components/ui/Textarea"
import { Select } from "@/components/ui/Select"
import { saveInitiative } from "../actions"
import { Loader2, Save, PlusCircle, Trash2, FileText, Upload } from "lucide-react"
interface InitiativeFormProps {
  plans: { id: string; title: string }[]
}

export function InitiativeForm({ plans }: InitiativeFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [indicators, setIndicators] = useState([{ name: "", type: "", measureTool: "", target: "" }])
  const [programs, setPrograms] = useState([{ name: "", goal: "", activities: "", executor: "" }])
  
  // حالة المرفقات الجديدة
  const [attachments, setAttachments] = useState<File[]>([])

  const handleAddIndicator = () => setIndicators([...indicators, { name: "", type: "", measureTool: "", target: "" }])
  const handleRemoveIndicator = (index: number) => setIndicators(indicators.filter((_, i) => i !== index))
  
  const handleAddProgram = () => setPrograms([...programs, { name: "", goal: "", activities: "", executor: "" }])
  const handleRemoveProgram = (index: number) => setPrograms(programs.filter((_, i) => i !== index))

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const newFiles = Array.from(files)
      setAttachments(prev => [...prev, ...newFiles])
    }
    // مسح قيمة حقل الإدخال ليصبح فارغاً جاهزاً لاختيار ملف آخر
    e.target.value = ""
  }

  const handleRemoveFile = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
    // مسح حقل الإدخال أيضاً عند الحذف
    const input = document.getElementById('evidence-upload') as HTMLInputElement
    if (input) input.value = ""
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    const formData = new FormData(e.currentTarget)
    formData.append("indicators", JSON.stringify(indicators))
    formData.append("programs", JSON.stringify(programs))
    
    // ملاحظة: لرفع الملفات فعلياً إلى الخادم، يجب تحويلها إلى Base64 أو استخدام API للرفع.
    // حالياً نكتسب بإظهارها في الواجهة فقط للتحقق من تجربة المستخدم.
    // إذا كان لديك حقل في قاعدة البيانات لحفظ أسماء الملفات، يمكن إضافتها هنا.
    // formData.append("attachmentNames", JSON.stringify(attachments.map(f => f.name)))

    try {
      await saveInitiative(formData)
      alert("تم حفظ المبادرة بنجاح")
      window.location.reload()
    } catch (err: any) {
      setError(err.message)
    }
    setLoading(false)
  }

  const handlePrint = () => {
    window.print()
  }

  const handleExportWord = () => {
    const form = document.getElementById("initiative-form") as HTMLFormElement
    const html = `
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Almarai', sans-serif; padding: 20px; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
          h1, h2, h3 { color: #0C3740; }
        </style>
      </head>
      <body>
        <h1>مبادرة: ${ (document.getElementById("name") as HTMLInputElement)?.value || "" }</h1>
        <p><strong>الجهة المنفذة:</strong> ${ (document.getElementById("entity") as HTMLInputElement)?.value || "" }</p>
        <p><strong>الفكرة العامة:</strong> ${ (document.getElementById("idea") as HTMLTextAreaElement)?.value || "" }</p>
        <h2>مؤشرات الأداء</h2>
        <table>
          <tr><th>المؤشر</th><th>النوع</th><th>أداة القياس</th><th>النسبة المستهدفة</th></tr>
          ${indicators.map(ind => `<tr><td>${ind.name}</td><td>${ind.type}</td><td>${ind.measureTool}</td><td>${ind.target}%</td></tr>`).join("")}
        </table>
        <h2>البرامج والإجراءات</h2>
        <table>
          <tr><th>البرنامج</th><th>الهدف</th><th>الأنشطة</th><th>المنفذ</th></tr>
          ${programs.map(prog => `<tr><td>${prog.name}</td><td>${prog.goal}</td><td>${prog.activities}</td><td>${prog.executor}</td></tr>`).join("")}
        </table>
      </body>
      </html>
    `
    const blob = new Blob([html], { type: "application/msword;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "مبادرة_جودة.doc"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <form id="initiative-form" onSubmit={handleSubmit} className="space-y-8">
      {error && <div className="p-3 bg-danger/10 text-danger rounded-lg text-sm">{error}</div>}

      <div className="flex justify-end gap-2 no-print">
        <Button type="button" variant="outline" size="md" icon={<PrinterIcon />} onClick={handlePrint}>طباعة / PDF</Button>
        <Button type="button" variant="outline" size="md" icon={<FileText className="w-4 h-4" />} onClick={handleExportWord}>Word</Button>
        <Button type="submit" disabled={loading} size="md" icon={loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}>
          {loading ? "جاري الحفظ..." : "حفظ المبادرة"}
        </Button>
      </div>

      <div className="p-6 border border-border rounded-lg">        
        <h3 className="text-lg font-bold text-[#079FDF] mb-4">بيانات المبادرة</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">اسم البرنامج / المبادرة</label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">الجهة المنفذة</label>
            <Input id="entity" name="entity" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">الفئة المستهدفة</label>
            <Input name="targetGroup" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">خطة التحسين المرتبطة من المنصة</label>
            <Select name="linkedPlanId">
              <option value="">— لا توجد خطة مرتبطة —</option>
              {plans.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-4">يمكن ربط المبادرة بخطة تحسين موجودة في المنصة، ويظل الربط محفوظًا مع المبادرة.</p>

        <div className="space-y-1.5 mb-4">
          <label className="text-sm font-medium">الفكرة العامة للمبادرة</label>
          <Textarea id="idea" name="idea" rows={3} />
        </div>
        <div className="space-y-1.5 mb-4">
          <label className="text-sm font-medium">الأهداف العامة</label>
          <Textarea name="generalGoals" rows={2} />
        </div>
        <div className="space-y-1.5 mb-4">
          <label className="text-sm font-medium">الأهداف الخاصة</label>
          <Textarea name="specialGoals" rows={2} />
        </div>
      </div>

      {/* مؤشرات الأداء */}
      <div className="p-6 border border-border rounded-lg">
        <h3 className="text-lg font-bold text-[#079FDF] mb-4">مؤشرات الأداء الخاصة بالمبادرة</h3>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm text-right border border-border rounded-lg overflow-hidden">
            <thead className="bg-surface-muted text-xs">
              <tr>
                <th className="p-2 w-10">#</th>
                <th className="p-2">المؤشر</th>
                <th className="p-2">نوعه</th>
                <th className="p-2">أداة القياس</th>
                <th className="p-2 w-24">النسبة المستهدفة</th>
                <th className="p-2 w-12 no-print"></th>
              </tr>
            </thead>
            <tbody>
              {indicators.map((ind, index) => (
                <tr key={index} className="border-t">
                  <td className="p-2 text-center">{index + 1}</td>
                  <td className="p-2"><Input value={ind.name} onChange={(e) => { const n = [...indicators]; n[index].name = e.target.value; setIndicators(n); }} className="h-8" /></td>
                  <td className="p-2"><Input value={ind.type} onChange={(e) => { const n = [...indicators]; n[index].type = e.target.value; setIndicators(n); }} className="h-8" /></td>
                  <td className="p-2"><Input value={ind.measureTool} onChange={(e) => { const n = [...indicators]; n[index].measureTool = e.target.value; setIndicators(n); }} className="h-8" /></td>
                  <td className="p-2"><div className="flex items-center"><Input type="number" value={ind.target} onChange={(e) => { const n = [...indicators]; n[index].target = e.target.value; setIndicators(n); }} className="h-8" /><span className="ml-1">%</span></div></td>
                  <td className="p-2 text-center no-print"><Button type="button" variant="ghost" size="icon-sm" onClick={() => handleRemoveIndicator(index)}><Trash2 className="w-4 h-4 text-danger" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button type="button" variant="outline" size="sm" icon={<PlusCircle className="w-4 h-4" />} onClick={handleAddIndicator}>إضافة مؤشر</Button>
      </div>

      {/* البرامج */}
      <div className="p-6 border border-border rounded-lg">
        <h3 className="text-lg font-bold text-[#079FDF] mb-4">برامج المبادرة وإجراءاتها</h3>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm text-right border border-border rounded-lg overflow-hidden">
            <thead className="bg-surface-muted text-xs">
              <tr>
                <th className="p-2">اسم البرنامج / الإجراء</th>
                <th className="p-2">الهدف والمحتوى</th>
                <th className="p-2">الأنشطة</th>
                <th className="p-2">المنفذ</th>
                <th className="p-2 w-12 no-print"></th>
              </tr>
            </thead>
            <tbody>
              {programs.map((prog, index) => (
                <tr key={index} className="border-t">
                  <td className="p-2"><Input value={prog.name} onChange={(e) => { const n = [...programs]; n[index].name = e.target.value; setPrograms(n); }} className="h-8" /></td>
                  <td className="p-2"><Textarea value={prog.goal} onChange={(e) => { const n = [...programs]; n[index].goal = e.target.value; setPrograms(n); }} rows={1} className="h-8" /></td>
                  <td className="p-2"><Textarea value={prog.activities} onChange={(e) => { const n = [...programs]; n[index].activities = e.target.value; setPrograms(n); }} rows={1} className="h-8" /></td>
                  <td className="p-2"><Input value={prog.executor} onChange={(e) => { const n = [...programs]; n[index].executor = e.target.value; setPrograms(n); }} className="h-8" /></td>
                  <td className="p-2 text-center no-print"><Button type="button" variant="ghost" size="icon-sm" onClick={() => handleRemoveProgram(index)}><Trash2 className="w-4 h-4 text-danger" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button type="button" variant="outline" size="sm" icon={<PlusCircle className="w-4 h-4" />} onClick={handleAddProgram}>إضافة برنامج / إجراء</Button>
      </div>

      {/* المتابعة والشواهد */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 border border-border rounded-lg">
          <h3 className="text-lg font-bold text-[#079FDF] mb-4">المتابعة والتقويم</h3>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">آلية التقويم والمتابعة</label>
              <Textarea name="followUp" rows={2} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">المدة الزمنية</label>
              <Input name="duration" />
            </div>
          </div>
        </div>

        <div className="p-6 border border-border rounded-lg">
          <h3 className="text-lg font-bold text-[#079FDF] mb-4">بيانات الشاهد</h3>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">اكتب وصف الشاهد أو ما يثبت تحقق الإجراء...</label>
              <Textarea name="evidenceText" rows={2} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">رابط الشاهد</label>
              <Input name="evidenceUrl" type="url" placeholder="https://" />
            </div>
            
            {/* تم تحديث قسم رفع الشواهد هنا */}
            <div className="space-y-2">
              <label className="text-sm font-medium">رفع الشاهد</label>
              
              {/* زر مخصص لإخفاء النص الافتراضي للمتصفح */}
              <label htmlFor="evidence-upload" className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 border border-slate-300 rounded-md text-xs text-slate-600 hover:bg-slate-50 transition-colors w-fit">
                <Upload className="w-3.5 h-3.5" />
                <span>اختر ملف</span>
              </label>
              
              {/* حقل الإدخال الفعلي مخفي */}
              <input id="evidence-upload" type="file" multiple onChange={handleFileChange} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden" />
              
              <div className="mt-2 space-y-2">
                {attachments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">لم تتم إضافة شواهد بعد.</p>
                ) : (
                  attachments.map((file, index) => (
                    <div key={index} className="flex items-center justify-between gap-2 p-2 bg-slate-100 rounded-md">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                        <span className="text-xs text-slate-700 truncate">{file.name}</span>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => handleRemoveFile(index)}
                        className="text-red-500 hover:text-red-700 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* الأثر والاستدامة */}
      <div className="p-6 border border-border rounded-lg">
        <h3 className="text-lg font-bold text-[#079FDF] mb-4">قياس الأثر والاستدامة</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">قياس الأثر</label>
            <Textarea name="impact" rows={2} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">الاستدامة</label>
            <Textarea name="sustainability" rows={2} />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">خطة التحسين للمبادرة</label>
          <Textarea name="improvementPlan" rows={2} />
        </div>
      </div>

    </form>
  )
}

// Helper component to avoid import issues if PrinterIcon is not available
function PrinterIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9"></polyline>
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
      <rect x="6" y="14" width="12" height="8"></rect>
    </svg>
  )
}