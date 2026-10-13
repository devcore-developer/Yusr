"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Progress } from "@/components/ui/Progress"
import { Modal } from "@/components/ui/Modal"
import { cn } from "@/lib/utils"
import { saveEvidenceResponse, finishAssessment, uploadAttachment, deleteAttachment } from "../actions"
import {
  CheckCircle, Menu, X, ClipboardCheck, Building2, 
  Loader2, Hash, Wrench, Calendar, ChevronDown, 
  Upload, Trash2, FileText
} from "lucide-react"

interface AssessmentEngineProps {
  assessment: any
  domains: any[]
  initialEvidenceResponses: any[]
  initialNotesResponses: any[]
  initialAttachments: any[]
  userRole?: string
  userId?: string
}

const TOOLS = [
  "البيئة المدرسية",
  "الملاحظة الصفية",
  "فحص الوثائق",
  "مقابلة المتعلمين",
  "مقابلة المدير",
  "مقابلة المعلمين",
  "مقابلة الموجه الطلابي"
]

export function AssessmentEngine({ assessment, domains, initialEvidenceResponses, initialNotesResponses, initialAttachments, userRole, userId }: AssessmentEngineProps) {
  const [activeTool, setActiveTool] = useState(TOOLS[0])
  const [activeVisit, setActiveVisit] = useState(1)
  const [responses, setResponses] = useState<Map<string, any>>(
    new Map(initialEvidenceResponses.filter((r: any) => r.isVerified).map((r: any) => [`${r.evidenceId}-${r.visitNumber || 0}`, r]))
  )
  const [attachments, setAttachments] = useState<any[]>(initialAttachments)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [isFinishOpen, setIsFinishOpen] = useState(false)
  const [detailsEvidence, setDetailsEvidence] = useState<any | null>(null)
  
  // إدارة حالة الطي للفقرات
  const [collapsedParagraphs, setCollapsedParagraphs] = useState<Set<string>>(new Set())

  const toggleParagraph = (indicatorId: string, paraNo: number) => {
    const key = `${indicatorId}-${paraNo}`
    setCollapsedParagraphs(prev => {
      const newSet = new Set(prev)
      if (newSet.has(key)) newSet.delete(key)
      else newSet.add(key)
      return newSet
    })
  }

  const isCompleted = assessment.status === "COMPLETED"
  const isReadOnly = isCompleted || (userRole === "SUPER_ADMIN" ? assessment.type !== "PRIVATE_REVIEW" : userId !== assessment.assessorId)

  const allIndicators = useMemo(() => domains.flatMap((d: any) => d.axes.flatMap((ax: any) => ax.indicators)), [domains])
  const allEvidence = useMemo(() => allIndicators.flatMap((i: any) => i.fixedEvidence), [allIndicators])

  const toolData = useMemo(() => {
    return TOOLS.map(toolName => {
      const evidence = allEvidence.filter((e: any) => e.tool === toolName)
      const groupedByIndicator: Record<string, any> = {}
      
      evidence.forEach((ev: any) => {
        const ind = allIndicators.find((i: any) => i.id === ev.indicatorId)
        if (!ind) return
        if (!groupedByIndicator[ind.code]) groupedByIndicator[ind.code] = { indicator: ind, paragraphs: [] }
        
        const pNo = Number(ev.paragraphNo) || 0
        let para = groupedByIndicator[ind.code].paragraphs.find((p: any) => p.no === pNo)
        if (!para) {
          para = { no: pNo, title: ev.paragraphText || "فقرة التقييم", items: [] }
          groupedByIndicator[ind.code].paragraphs.push(para)
        }
        para.items.push(ev)
      })
      
      const groupedArray = Object.values(groupedByIndicator)

      groupedArray.sort((a: any, b: any) => {
        const aNo = a.paragraphs[0]?.no ?? 0
        const bNo = b.paragraphs[0]?.no ?? 0
        return Number(aNo) - Number(bNo)
      })

      groupedArray.forEach((g: any) => {
        g.paragraphs.sort((a: any, b: any) => Number(a.no) - Number(b.no))
      })
      
      return { name: toolName, evidence, grouped: groupedArray }
    })
  }, [allEvidence, allIndicators])

  const activeToolData = toolData.find(t => t.name === activeTool)

  const handleEvidenceChange = async (evidenceId: string, checked: boolean, scoreValue?: number) => {
    if (isReadOnly) return
    const visit = activeTool === "الملاحظة الصفية" ? activeVisit : 0
    const key = `${evidenceId}-${visit}`
    
    setResponses(prev => {
      const newMap = new Map(prev)
      if (checked || scoreValue) newMap.set(key, { evidenceId, visitNumber: visit, isVerified: true, scoreValue })
      else newMap.delete(key)
      return newMap
    })

    setSavingId(evidenceId)
    try {
      await saveEvidenceResponse(assessment.id, evidenceId, checked || !!scoreValue, visit, scoreValue)
    } catch (e) {
      setResponses(prev => {
        const newMap = new Map(prev)
        if (checked) newMap.delete(key)
        else newMap.set(key, { evidenceId, visitNumber: visit, isVerified: true })
        return newMap
      })
      alert("حدث خطأ أثناء الحفظ. تأكد من أنك مالك هذا التقييم.")
    }
    setSavingId(null)
  }

  const handleFileUpload = async (evidenceId: string, file: File) => {
    if (isReadOnly) return
    if (file.size > 2 * 1024 * 1024) {
      alert("حجم الملف يتجاوز 2 ميجابايت")
      return
    }
    const reader = new FileReader()
    reader.onload = async () => {
      const base64Data = reader.result as string
      try {
        const res = await uploadAttachment(assessment.id, evidenceId, { name: file.name, type: file.type, size: file.size, data: base64Data })
        setAttachments(prev => [...prev, { id: res.id, evidenceId, fileName: file.name, fileType: file.type, fileData: base64Data }])
      } catch (err) {
        alert("فشل رفع الملف")
      }
    }
    reader.readAsDataURL(file)
  }

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (isReadOnly) return
    try {
      await deleteAttachment(attachmentId, assessment.id)
      setAttachments(prev => prev.filter(a => a.id !== attachmentId))
    } catch (err) {
      alert("فشل حذف الملف")
    }
  }

  const isEvidenceChecked = (evidenceId: string) => {
    const visit = activeTool === "الملاحظة الصفية" ? activeVisit : 0
    return responses.has(`${evidenceId}-${visit}`)
  }

  const totalEvidence = allEvidence.length
  const verifiedCount = Array.from(responses.values()).filter(r => r.isVerified).length
  const progress = totalEvidence > 0 ? Math.round((verifiedCount / totalEvidence) * 100) : 0

  const handleFinish = async () => {
    try {
      await finishAssessment(assessment.id)
      window.location.href = "/quality-assessor"
    } catch (e: any) {
      alert(e.message)
    }
  }

  return (
    <div className="space-y-6 overflow-x-hidden">
      <Card className="border-border/70 shadow-premium overflow-hidden">
        <CardContent className="p-5 lg:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 min-w-0">
            <div className="flex items-start gap-4 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <ClipboardCheck className="w-6 h-6 text-primary" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-foreground-strong truncate">{assessment.school.name}</h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-1.5 text-[13px] text-muted-foreground">
                  {assessment.branch && <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 shrink-0" /> {assessment.branch.name}</span>}
                  <span className="flex items-center gap-1.5"><Hash className="w-3.5 h-3.5 shrink-0" /> {totalEvidence} شاهد</span>
                  <Badge variant={isCompleted ? "success" : "warning"} dot>{isCompleted ? "مكتمل" : "جاري التقييم"}</Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6 shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative w-14 h-14 shrink-0">
                  <svg className="w-14 h-14 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--surface-muted))" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--secondary))" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(progress / 100) * 97.34} 97.34`} className="transition-all duration-500 ease-smooth" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center"><span className="text-sm font-bold text-foreground-strong numeric">{progress}%</span></div>
                </div>
                <div className="text-xs text-muted-foreground"><p className="font-semibold text-foreground-strong numeric">{verifiedCount} / {totalEvidence}</p><p>شاهد متحقق</p></div>
              </div>
              {!isCompleted && <Button variant="success" size="md" icon={<CheckCircle className="w-4 h-4" />} onClick={() => setIsFinishOpen(true)} disabled={isReadOnly}>إنهاء التقييم</Button>}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="lg:hidden flex items-center justify-between p-2.5 bg-surface border border-border rounded-lg sticky top-16 z-20 shadow-sm">
        <Button variant="outline" size="sm" icon={<Menu className="w-4 h-4" />}>التنقل</Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 min-w-0">
        <div className="flex-1 min-w-0 space-y-6">
          {/* Tool Tabs */}
          <div className="flex flex-wrap gap-2 pb-2 border-b border-border">
            {toolData.map((tool) => {
              const toolVerified = tool.evidence.filter((e: any) => isEvidenceChecked(e.id)).length
              return (
                <button key={tool.name} onClick={() => setActiveTool(tool.name)} className={cn("px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-smooth flex items-center gap-2", activeTool === tool.name ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:bg-surface-muted border border-transparent")}>
                  {tool.name}
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full numeric", activeTool === tool.name ? "bg-primary/20 text-primary" : "bg-surface-muted text-muted-foreground")}>{toolVerified}/{tool.evidence.length}</span>
                </button>
              )
            })}
          </div>

          {/* Active Tool Content */}
          {activeToolData && (
            <>
              <Card className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-surface-muted/30">
                <div className="flex items-center gap-3 min-w-0">
                  <Wrench className="w-5 h-5 text-primary shrink-0" />
                  <div className="min-w-0"><h3 className="text-sm font-bold text-foreground-strong truncate">{activeToolData.name}</h3><p className="text-xs text-muted-foreground">{activeToolData.evidence.length} شاهد مطلوب</p></div>
                </div>
                <div className="w-full md:w-48 shrink-0"><Progress value={activeToolData.evidence.length > 0 ? (activeToolData.evidence.filter((e: any) => isEvidenceChecked(e.id)).length / activeToolData.evidence.length) * 100 : 0} size="sm" tone="default" /></div>
              </Card>

              {activeTool === "الملاحظة الصفية" && (
                <Card className="p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                  <div className="flex items-center gap-2 shrink-0"><Calendar className="w-5 h-5 text-primary" /><h3 className="text-sm font-bold text-foreground-strong">الزيارة الحالية:</h3></div>
                  <div className="flex gap-2 flex-wrap">
                    {[1, 2, 3, 4, 5, 6, 7].map(v => (
                      <button key={v} onClick={() => setActiveVisit(v)} className={cn("w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold transition-smooth", activeVisit === v ? "bg-primary text-white" : "bg-surface-muted text-foreground hover:bg-primary/10")}>{v}</button>
                    ))}
                  </div>
                </Card>
              )}

              {/* Evidence List */}
              <div className="space-y-3 min-w-0">
                {activeToolData.grouped.map((group: any) => (
                  <div key={group.indicator.id} className="space-y-3 min-w-0">
                    <div className="px-4 py-2 bg-primary/5 rounded-lg border border-primary/10 min-w-0">
                      <div className="flex items-start gap-3">
                        <Badge variant="neutral" className="font-mono numeric shrink-0 text-[11px] mt-0.5">{group.indicator.code}</Badge>
                        <p className="text-[14px] text-foreground-strong leading-relaxed font-medium flex-1 min-w-0">{group.indicator.description}</p>
                      </div>
                    </div>
                    
                    {group.paragraphs.map((para: any) => {
                      const paraKey = `${group.indicator.id}-${para.no}`
                      const isCollapsed = collapsedParagraphs.has(paraKey)
                      const verifiedInPara = para.items.filter((e:any) => isEvidenceChecked(e.id)).length

                      return (
                        <Card key={paraKey} className="overflow-hidden">
                          {/* Email Header - Clickable to Toggle */}
                          <div
                            role="button"
                            tabIndex={0}
                            aria-expanded={!isCollapsed}
                            onClick={() => toggleParagraph(group.indicator.id, para.no)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleParagraph(group.indicator.id, para.no) } }}
                            className="p-4 border-b border-border flex items-center justify-between cursor-pointer hover:bg-surface-muted/50 transition-smooth min-w-0"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <Badge variant="info" className="shrink-0 whitespace-nowrap">الفقرة {para.no}</Badge>
                              <p className="text-sm font-medium text-foreground-strong min-w-0 break-words">{para.title}</p>
                            </div>
                            
                            <div className="flex items-center gap-3 shrink-0 mr-2">
                              {/* Counter: nowrap and shrink-0 prevents breaking */}
                              <div className="text-xs text-muted-foreground numeric whitespace-nowrap">
                                {verifiedInPara} / {para.items.length}
                              </div>
                              <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform shrink-0", isCollapsed ? "" : "rotate-180")} />
                            </div>
                          </div>

                          {/* Collapsible Content */}
                          {!isCollapsed && (
                            <div className="divide-y divide-border/70">
                              {para.items.map((ev: any) => {
                                const checked = isEvidenceChecked(ev.id)
                                const evAttachments = attachments.filter(a => a.evidenceId === ev.id)
                                return (
                                  <div key={ev.id} className={cn("p-4 transition-smooth", checked ? "bg-success/5" : "hover:bg-surface-muted/50")}>
                                    <div className="flex items-start justify-between gap-4 mb-3">
                                      <p className="text-sm text-foreground-strong flex-1">{ev.text}</p>
                                      <button 
                                        type="button" 
                                        onClick={(e) => { e.stopPropagation(); handleEvidenceChange(ev.id, !checked) }} 
                                        disabled={isReadOnly} 
                                        className={cn(
                                          "w-6 h-6 rounded flex items-center justify-center transition-smooth border-2 shrink-0", 
                                          checked ? "bg-success border-success text-white" : "border-border bg-surface hover:border-primary", 
                                          isReadOnly ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                                        )}
                                      >
                                        {checked && <CheckCircle className="w-4 h-4" />}
                                      </button>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                      <label className={cn("cursor-pointer", isReadOnly && "pointer-events-none opacity-50")}>
                                        <span className="inline-flex items-center gap-1 text-xs text-cyan-600 hover:underline">
                                          <Upload className="w-3 h-3" /> إرفاق شاهد
                                        </span>
                                        <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(ev.id, e.target.files[0])} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.svg" disabled={isReadOnly} />
                                      </label>
                                      {evAttachments.map(att => (
                                        <div key={att.id} className="flex items-center gap-1 text-xs bg-slate-100 px-2 py-1 rounded">
                                          <FileText className="w-3 h-3" />
                                          <a href={att.fileData} download={att.fileName} className="hover:underline truncate max-w-[100px]">{att.fileName}</a>
                                          {!isReadOnly && <button onClick={() => handleDeleteAttachment(att.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-3 h-3" /></button>}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </Card>
                      )
                    })}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Sidebar Overview (Desktop) */}
        <aside className="hidden lg:block w-72 flex-shrink-0">
          <div className="sticky top-20 space-y-4">
            <Card className="p-4">
              <h3 className="text-sm font-bold text-foreground-strong mb-3">تقدم الأدوات</h3>
              <div className="space-y-2">
                {toolData.map((tool) => {
                  const verified = tool.evidence.filter((e: any) => isEvidenceChecked(e.id)).length
                  const total = tool.evidence.length
                  const pct = total > 0 ? Math.round((verified / total) * 100) : 0
                  return (
                    <button key={tool.name} onClick={() => setActiveTool(tool.name)} className={cn("w-full text-right p-2 rounded-lg transition-smooth", activeTool === tool.name ? "bg-primary/10" : "hover:bg-surface-muted")}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={cn("text-xs font-medium", activeTool === tool.name ? "text-primary" : "text-foreground-strong")}>{tool.name}</span>
                        <span className="text-[11px] text-muted-foreground numeric">{verified}/{total}</span>
                      </div>
                      <Progress value={pct} size="sm" className="h-1" tone="default" />
                    </button>
                  )
                })}
              </div>
            </Card>
          </div>
        </aside>
      </div>

      <Modal isOpen={isFinishOpen} onClose={() => setIsFinishOpen(false)} title="تأكيد إنهاء التقييم" description="لن تتمكن من تعديل الإجابات بعد الإنهاء.">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-success/5 border border-success/20 rounded-lg text-center"><p className="text-xs text-muted-foreground">الشواهد المتحققة</p><p className="text-2xl font-bold text-success numeric mt-1">{verifiedCount}</p></div>
            <div className="p-4 bg-danger/5 border border-danger/20 rounded-lg text-center"><p className="text-xs text-muted-foreground">الشواهد المتبقية</p><p className="text-2xl font-bold text-danger numeric mt-1">{totalEvidence - verifiedCount}</p></div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setIsFinishOpen(false)}>إلغاء</Button>
            <Button variant="success" icon={<CheckCircle className="w-4 h-4" />} onClick={handleFinish}>تأكيد الإنهاء</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}