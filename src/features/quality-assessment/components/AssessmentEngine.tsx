"use client"

import { useState, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Progress } from "@/components/ui/Progress"
import { Modal } from "@/components/ui/Modal"
import { cn } from "@/lib/utils"
import { saveEvidenceResponse, finishAssessment } from "../actions"
import {
  CheckCircle, Menu, X, ClipboardCheck, Building2, 
  Loader2, Hash, Wrench, Calendar, ChevronDown, FileText, AlertTriangle
} from "lucide-react"

interface AssessmentEngineProps {
  assessment: any
  domains: any[]
  initialResponses: any[]
  userRole?: string
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

export function AssessmentEngine({ assessment, domains, initialResponses, userRole }: AssessmentEngineProps) {
  const [activeTool, setActiveTool] = useState(TOOLS[0])
  const [activeVisit, setActiveVisit] = useState(1)
  const [responses, setResponses] = useState<Map<string, any>>(
    new Map(initialResponses.map((r: any) => [`${r.evidenceId}-${r.visitNumber || 0}`, r]))
  )
  const [savingId, setSavingId] = useState<string | null>(null)
  const [isFinishOpen, setIsFinishOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [detailsEvidence, setDetailsEvidence] = useState<any | null>(null)

  const isCompleted = assessment.status === "COMPLETED"
  const isReadOnly = isCompleted || (userRole === "SUPER_ADMIN" && assessment.type !== "PRIVATE_REVIEW")

  const allIndicators = useMemo(() => {
    return domains.flatMap((d: any) => d.axes.flatMap((ax: any) => ax.indicators))
  }, [domains])

  const allEvidence = useMemo(() => {
    return allIndicators.flatMap((i: any) => i.fixedEvidence)
  }, [allIndicators])

  const toolData = useMemo(() => {
    return TOOLS.map(toolName => {
      const evidence = allEvidence.filter((e: any) => e.tool === toolName)
      const groupedByIndicator: Record<string, any> = {}
      
      evidence.forEach((ev: any) => {
        const ind = allIndicators.find((i: any) => i.id === ev.indicatorId)
        if (!ind) return
        
        if (!groupedByIndicator[ind.code]) {
          groupedByIndicator[ind.code] = { indicator: ind, paragraphs: {} }
        }
        const pNo = ev.paragraphNo || 0
        if (!groupedByIndicator[ind.code].paragraphs[pNo]) {
          groupedByIndicator[ind.code].paragraphs[pNo] = {
            no: pNo,
            title: ev.paragraphText || "فقرة التقييم",
            items: []
          }
        }
        groupedByIndicator[ind.code].paragraphs[pNo].items.push(ev)
      })
      
      return { name: toolName, evidence, grouped: Object.values(groupedByIndicator) }
    })
  }, [allEvidence, allIndicators])

  const activeToolData = toolData.find(t => t.name === activeTool)

  const handleEvidenceChange = async (evidenceId: string, checked: boolean, scoreValue?: number) => {
    if (isReadOnly) return

    const visit = activeTool === "الملاحظة الصفية" ? activeVisit : 0
    const key = `${evidenceId}-${visit}`
    
    setResponses(prev => {
      const newMap = new Map(prev)
      if (checked || scoreValue) {
        newMap.set(key, { evidenceId, visitNumber: visit, isVerified: true, scoreValue })
      } else {
        newMap.delete(key)
      }
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
    }
    setSavingId(null)
  }

  const isEvidenceChecked = (evidenceId: string) => {
    const visit = activeTool === "الملاحظة الصفية" ? activeVisit : 0
    return responses.has(`${evidenceId}-${visit}`)
  }

  const getScoreValue = (evidenceId: string) => {
    const visit = activeTool === "الملاحظة الصفية" ? activeVisit : 0
    return responses.get(`${evidenceId}-${visit}`)?.scoreValue || 0
  }

  const totalEvidence = allEvidence.length
  const verifiedCount = Array.from(responses.values()).filter(r => r.isVerified).length
  const progress = totalEvidence > 0 ? Math.round((verifiedCount / totalEvidence) * 100) : 0

  const handleFinish = async () => {
    try {
      await finishAssessment(assessment.id)
      window.location.href = "/quality-assessor"
    } catch {}
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
                  {assessment.branch && (
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 shrink-0" /> {assessment.branch.name}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 shrink-0" /> {totalEvidence} شاهد
                  </span>
                  <Badge variant={isCompleted ? "success" : "warning"} dot>
                    {isCompleted ? "مكتمل" : "جاري التقييم"}
                  </Badge>
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
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold text-foreground-strong numeric">{progress}%</span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground-strong numeric">{verifiedCount} / {totalEvidence}</p>
                  <p>شاهد متحقق</p>
                </div>
              </div>
              {!isCompleted && (
                <Button variant="success" size="md" icon={<CheckCircle className="w-4 h-4" />} onClick={() => setIsFinishOpen(true)} disabled={isReadOnly}>
                  إنهاء التقييم
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="lg:hidden flex items-center justify-between p-2.5 bg-surface border border-border rounded-lg sticky top-16 z-20 shadow-sm">
        <Button variant="outline" size="sm" icon={sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />} onClick={() => setSidebarOpen(!sidebarOpen)}>
          التنقل
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 min-w-0">
        <div className="flex-1 min-w-0 space-y-6">
          <div className="flex flex-wrap gap-2 pb-2 border-b border-border">
            {toolData.map((tool) => {
              const toolVerified = tool.evidence.filter((e: any) => isEvidenceChecked(e.id)).length
              return (
                <button
                  key={tool.name}
                  onClick={() => setActiveTool(tool.name)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-smooth flex items-center gap-2",
                    activeTool === tool.name ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:bg-surface-muted border border-transparent"
                  )}
                >
                  {tool.name}
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full numeric", activeTool === tool.name ? "bg-primary/20 text-primary" : "bg-surface-muted text-muted-foreground")}>
                    {toolVerified}/{tool.evidence.length}
                  </span>
                </button>
              )
            })}
          </div>

          {activeToolData && (
            <>
              <Card className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-surface-muted/30">
                <div className="flex items-center gap-3 min-w-0">
                  <Wrench className="w-5 h-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-foreground-strong truncate">{activeToolData.name}</h3>
                    <p className="text-xs text-muted-foreground">{activeToolData.evidence.length} شاهد مطلوب</p>
                  </div>
                </div>
                <div className="w-full md:w-48 shrink-0">
                  <Progress 
                    value={activeToolData.evidence.length > 0 ? (activeToolData.evidence.filter((e: any) => isEvidenceChecked(e.id)).length / activeToolData.evidence.length) * 100 : 0} 
                    size="sm" 
                    tone="default" 
                  />
                </div>
              </Card>

              {activeTool === "الملاحظة الصفية" && (
                <Card className="p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                  <div className="flex items-center gap-2 shrink-0">
                    <Calendar className="w-5 h-5 text-primary" />
                    <h3 className="text-sm font-bold text-foreground-strong">الزيارة الحالية:</h3>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {[1, 2, 3, 4, 5, 6, 7].map(v => (
                      <button
                        key={v}
                        onClick={() => setActiveVisit(v)}
                        className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold transition-smooth",
                          activeVisit === v ? "bg-primary text-white" : "bg-surface-muted text-foreground hover:bg-primary/10"
                        )}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </Card>
              )}

              <div className="space-y-3 min-w-0">
                {activeToolData.grouped.length === 0 ? (
                  <Card className="p-12 text-center">
                    <ClipboardCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-base font-semibold text-foreground-strong">لا توجد شواهد لهذه الأداة</h3>
                  </Card>
                ) : (
                  activeToolData.grouped.map((group: any) => (
                    <div key={group.indicator.id} className="space-y-3 min-w-0">
                      <div className="px-4 py-2 bg-primary/5 rounded-lg border border-primary/10 min-w-0">
                        <div className="flex items-start gap-3">
                          <Badge variant="neutral" className="font-mono numeric shrink-0 text-[11px] mt-0.5">{group.indicator.code}</Badge>
                          <p className="text-[14px] text-foreground-strong leading-relaxed font-medium flex-1 min-w-0">{group.indicator.description}</p>
                        </div>
                      </div>

                      {Object.values(group.paragraphs).map((para: any) => (
                        <ParagraphAccordion
                          key={`${group.indicator.id}-${para.no}`}
                          para={para}
                          isChecked={isEvidenceChecked}
                          getScore={getScoreValue}
                          onToggle={handleEvidenceChange}
                          onDetails={setDetailsEvidence}
                          isReadOnly={isReadOnly}
                          savingId={savingId}
                        />
                      ))}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

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
                    <button
                      key={tool.name}
                      onClick={() => setActiveTool(tool.name)}
                      className={cn(
                        "w-full text-right p-2 rounded-lg transition-smooth",
                        activeTool === tool.name ? "bg-primary/10" : "hover:bg-surface-muted"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={cn("text-xs font-medium", activeTool === tool.name ? "text-primary" : "text-foreground-strong")}>
                          {tool.name}
                        </span>
                        <span className="text-[11px] text-muted-foreground numeric">{verified}/{total}</span>
                      </div>
                      <Progress value={pct} size="sm" className="h-1" tone={activeTool === tool.name ? "default" : "default"} />
                    </button>
                  )
                })}
              </div>
            </Card>
          </div>
        </aside>
      </div>

      <Modal 
        isOpen={!!detailsEvidence} 
        onClose={() => setDetailsEvidence(null)} 
        title="تفاصيل الشاهد" 
        description={detailsEvidence?.indicatorCode}
      >
        {detailsEvidence && (
          <div className="space-y-4">
            <div className="p-4 bg-surface-muted rounded-lg">
              <p className="text-sm text-foreground-strong font-medium">{detailsEvidence.text}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-1">الأداة</p>
                <p className="font-medium text-foreground-strong">{detailsEvidence.tool}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">الفقرة</p>
                <p className="font-medium text-foreground-strong numeric">{detailsEvidence.paragraphNo}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground mb-1">نص الفقرة</p>
                <p className="font-medium text-foreground-strong">{detailsEvidence.paragraphText}</p>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setDetailsEvidence(null)}>إغلاق</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isFinishOpen} onClose={() => setIsFinishOpen(false)} title="تأكيد إنهاء التقييم" description="لن تتمكن من تعديل الإجابات بعد الإنهاء.">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-success/5 border border-success/20 rounded-lg text-center">
              <p className="text-xs text-muted-foreground">الشواهد المتحققة</p>
              <p className="text-2xl font-bold text-success numeric mt-1">{verifiedCount}</p>
            </div>
            <div className="p-4 bg-danger/5 border border-danger/20 rounded-lg text-center">
              <p className="text-xs text-muted-foreground">الشواهد المتبقية</p>
              <p className="text-2xl font-bold text-danger numeric mt-1">{totalEvidence - verifiedCount}</p>
            </div>
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

function ParagraphAccordion({ para, isChecked, getScore, onToggle, onDetails, isReadOnly, savingId }: any) {
  const [isOpen, setIsOpen] = useState(false)
  const verifiedCount = para.items.filter((e: any) => isChecked(e.id)).length
  const totalCount = para.items.length
  const progress = totalCount > 0 ? Math.round((verifiedCount / totalCount) * 100) : 0

  return (
    <Card className="overflow-hidden">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between gap-4 hover:bg-surface-muted/50 transition-smooth"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Badge variant="info" className="shrink-0">الفقرة {para.no}</Badge>
          <p className="text-sm font-medium text-foreground-strong truncate">{para.title}</p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-xs text-muted-foreground numeric">
            {verifiedCount} / {totalCount}
          </div>
          <div className="w-20 hidden sm:block">
            <Progress value={progress} size="sm" className="h-1.5" tone={progress === 100 ? "success" : "default"} />
          </div>
          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-border bg-surface-muted/20">
          <div className="w-full overflow-hidden">
            <table className="w-full table-fixed text-sm text-right">
              <colgroup>
                <col className="w-12" />
                <col />
                <col className="w-24" />
                <col className="w-20" />
              </colgroup>
              <thead className="text-[11px] text-muted-foreground uppercase">
                <tr className="border-b border-border">
                  <th className="px-4 py-2 font-medium">م</th>
                  <th className="px-4 py-2 font-medium">نص الشاهد</th>
                  <th className="px-4 py-2 font-medium">الحالة</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {para.items.map((ev: any, idx: number) => {
                  const checked = isChecked(ev.id)
                  const isSpecial = ev.indicatorCode === '2-1-1-3' && ev.paragraphNo === 4
                  const score = getScore(ev.id)
                  
                  return (
                    <tr key={ev.id} className={cn("transition-smooth", checked ? "bg-success/5" : "hover:bg-surface-muted/50")}>
                      <td className="px-4 py-3 text-muted-foreground numeric align-top">{idx + 1}</td>
                      <td className="px-4 py-3 text-foreground-strong break-words whitespace-normal">{ev.text}</td>
                      <td className="px-4 py-3 align-top">
                        {isSpecial ? (
                          <select
                            value={score}
                            onChange={(e) => onToggle(ev.id, Number(e.target.value) > 0, Number(e.target.value))}
                            disabled={isReadOnly}
                            className="h-8 px-2 rounded-md border border-border bg-surface text-xs focus:outline-none focus:ring-2 focus:ring-secondary/30 w-full"
                          >
                            <option value="0">اختر</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                          </select>
                        ) : (
                          <button
                            onClick={() => onToggle(ev.id, !checked)}
                            disabled={isReadOnly}
                            className={cn(
                              "w-6 h-6 rounded flex items-center justify-center transition-smooth border-2",
                              checked ? "bg-success border-success text-white" : "border-border bg-surface",
                              isReadOnly && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            {checked && <CheckCircle className="w-4 h-4" />}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-left align-top">
                        <button 
                          onClick={() => onDetails(ev)}
                          className="text-xs text-secondary hover:underline font-medium"
                        >
                          تفاصيل
                        </button>
                        {savingId === ev.id && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground inline-block mr-2" />}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  )
}