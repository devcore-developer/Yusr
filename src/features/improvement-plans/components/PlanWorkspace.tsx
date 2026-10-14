"use client"

import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select"
import { Badge } from "@/components/ui/Badge"
import { addAction, updateActionProgress, addFollowUp } from "../actions"
import { Loader2, PlusCircle, CheckCircle, XCircle, Clock, AlertCircle, Save } from "lucide-react"
import { cn } from "@/lib/utils"

interface PlanWorkspaceProps {
  plan: any
}

export function PlanWorkspace({ plan }: PlanWorkspaceProps) {
  const [loadingAction, setLoadingAction] = useState(false)
  const [loadingFollowUp, setLoadingFollowUp] = useState(false)
  
  const [newActionTitle, setNewActionTitle] = useState("")
  const [newActionDate, setNewActionDate] = useState("")
  
  const [followUpNote, setFollowUpNote] = useState("")
  const [actionChanges, setActionChanges] = useState<Record<string, { progress: number; status: string }>>({})
  const [savingActionId, setSavingActionId] = useState<string | null>(null)
  const [savedActionId, setSavedActionId] = useState<string | null>(null)

  const handleAddAction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newActionTitle) return
    setLoadingAction(true)
    
    const formData = new FormData()
    formData.append("title", newActionTitle)
    formData.append("status", "PENDING")
    if (newActionDate) formData.append("dueDate", newActionDate)
    
    try {
      await addAction(plan.id, formData)
      setNewActionTitle("")
      setNewActionDate("")
    } catch (error) {
      console.error(error)
    }
    setLoadingAction(false)
  }

  const handleStatusChange = (actionId: string, newStatus: string, currentProgress: number) => {
    let newProgress = currentProgress;

    // مزامنة النسبة مع الحالة في الواجهة فوراً
    if (newStatus === "COMPLETED") {
      newProgress = 100;
    } else if (newStatus === "PENDING") {
      newProgress = 0;
    } else {
      // جارية أو متعثرة
      if (currentProgress === 100) newProgress = 99; // لا يمكن أن تبقى 100%
    }

    setActionChanges(prev => ({
      ...prev,
      [actionId]: { progress: newProgress, status: newStatus }
    }));
  };

  const handleProgressChange = (actionId: string, value: number, currentStatus: string) => {
    // منع إدخال 100% إذا لم تكن الحالة "مكتملة"
    if (value >= 100 && currentStatus !== "COMPLETED") {
      value = 99;
    }
    // منع إدخال رقم سالب
    if (value < 0) value = 0;

    setActionChanges(prev => ({
      ...prev,
      [actionId]: { progress: value, status: currentStatus }
    }));
  };

  const handleUpdateAction = async (actionId: string) => {
    const changes = actionChanges[actionId]
    if (!changes) return

    setSavingActionId(actionId)
    setSavedActionId(null)

    try {
      await updateActionProgress(actionId, changes.status, plan.id, changes.progress)
      
      setActionChanges(prev => {
        const newState = { ...prev }
        delete newState[actionId]
        return newState
      })

      setSavedActionId(actionId)
      setTimeout(() => setSavedActionId(null), 2000)

    } catch (error) {
      console.error("Save error:", error)
      alert("حدث خطأ أثناء الحفظ.")
    } finally {
      setSavingActionId(null)
    }
  }

  const handleAddFollowUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!followUpNote) return
    setLoadingFollowUp(true)
    
    const formData = new FormData()
    formData.append("note", followUpNote)
    
    try {
      await addFollowUp(plan.id, formData)
      setFollowUpNote("")
    } catch (error) {
      console.error(error)
    }
    setLoadingFollowUp(false)
  }

  return (
    <div className="space-y-8">
      {/* Existing Actions */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-foreground-strong">إجراءات التحسين</h3>
        <div className="divide-y divide-border border border-border rounded-lg">
          {plan.actions?.map((action: any) => {
            const currentProgress = actionChanges[action.id]?.progress ?? action.progress ?? 0
            const currentStatus = actionChanges[action.id]?.status ?? action.status
            const hasChanges = !!actionChanges[action.id]
            const isSaving = savingActionId === action.id
            const isSaved = savedActionId === action.id
            const isDisabled = currentStatus === "COMPLETED" || currentStatus === "PENDING"

            return (
              <div key={action.id} className="p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <p className="text-sm font-medium text-foreground-strong">{action.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      المستهدف: {action.dueDate ? new Date(action.dueDate).toLocaleDateString('ar-SA') : "غير محدد"}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1">
                      <Input 
                        type="number" 
                        min="0" 
                        max="100" 
                        value={currentProgress}
                        onChange={(e) => handleProgressChange(action.id, Number(e.target.value), currentStatus)}
                        className="h-8 text-xs w-20"
                        disabled={isDisabled || isSaving} // تعطيل الحقل إذا كانت مكتملة أو لم تبدأ
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>

                    <Select 
                      value={currentStatus}
                      onValueChange={(val: string) => handleStatusChange(action.id, val, currentProgress)}
                      disabled={isSaving}
                    >
                      <SelectTrigger className="h-8 text-xs w-32">
                        <SelectValue placeholder="الحالة" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PENDING">لم تبدأ</SelectItem>
                        <SelectItem value="IN_PROGRESS">جارية</SelectItem>
                        <SelectItem value="COMPLETED">مكتملة</SelectItem>
                        <SelectItem value="DELAYED">متعثرة</SelectItem>
                      </SelectContent>
                    </Select>

                    <div className="w-4 h-4 flex items-center justify-center">
                      {currentStatus === "COMPLETED" && <CheckCircle className="w-4 h-4 text-success" />}
                      {currentStatus === "DELAYED" && <AlertCircle className="w-4 h-4 text-danger" />}
                      {currentStatus === "IN_PROGRESS" && <Clock className="w-4 h-4 text-warning" />}
                    </div>

                    <div className="w-24 flex justify-end">
                      {isSaving ? (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>جاري الحفظ...</span>
                        </div>
                      ) : isSaved ? (
                        <div className="flex items-center gap-1 text-xs text-success">
                          <CheckCircle className="w-3 h-3" />
                          <span>تم الحفظ</span>
                        </div>
                      ) : (
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm" 
                          className="h-8 px-2 text-xs"
                          onClick={() => handleUpdateAction(action.id)}
                          disabled={!hasChanges || isSaving}
                        >
                          <Save className="w-3 h-3 ml-1" />
                          حفظ
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Add New Action Form */}
        <form onSubmit={handleAddAction} className="flex items-end gap-2 p-4 bg-surface-muted/30 rounded-lg">
          <div className="flex-1 space-y-1">
            <label className="text-xs font-medium">إجراء جديد</label>
            <Input 
              value={newActionTitle} 
              onChange={(e) => setNewActionTitle(e.target.value)} 
              placeholder="أدخل وصف الإجراء..." 
              required 
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">تاريخ الانتهاء</label>
            <Input 
              type="date" 
              value={newActionDate} 
              onChange={(e) => setNewActionDate(e.target.value)} 
              className="w-auto"
            />
          </div>
          <Button type="submit" disabled={loadingAction} size="md" icon={loadingAction ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}>
            إضافة
          </Button>
        </form>
      </div>

      {/* Follow-ups */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-foreground-strong">سجل المتابعة</h3>
        <div className="space-y-3">
          {plan.followUps?.map((fu: any) => (
            <div key={fu.id} className="p-4 border border-border rounded-lg bg-surface">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-muted-foreground">{new Date(fu.createdAt).toLocaleString('ar-SA')}</span>
                {fu.progress !== null && <Badge variant="info">{fu.progress}%</Badge>}
              </div>
              <p className="text-sm text-foreground-strong">{fu.note}</p>
            </div>
          ))}
        </div>

        {/* Add Follow-up Form */}
        <form onSubmit={handleAddFollowUp} className="space-y-3 p-4 bg-surface-muted/30 rounded-lg">
          <div className="space-y-1">
            <label className="text-sm font-medium">إضافة ملاحظة متابعة</label>
            <Input 
              value={followUpNote} 
              onChange={(e) => setFollowUpNote(e.target.value)} 
              placeholder="ما هي آخر المستجدات؟" 
              required 
            />
          </div>
          <Button type="submit" disabled={loadingFollowUp} size="md" icon={loadingFollowUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}>
            حفظ المتابعة
          </Button>
        </form>
      </div>
    </div>
  )
}