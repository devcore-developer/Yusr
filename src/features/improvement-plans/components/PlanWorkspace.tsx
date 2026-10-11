"use client"

import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { Badge } from "@/components/ui/Badge"
import { addAction, updateActionProgress, addFollowUp } from "../actions"
import { Loader2, PlusCircle, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react"
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
  const [followUpProgress, setFollowUpProgress] = useState(0)

  const handleAddAction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newActionTitle) return
    setLoadingAction(true)
    
    const formData = new FormData()
    formData.append("title", newActionTitle)
    formData.append("status", "PENDING")
    formData.append("dueDate", newActionDate)
    
    try {
      await addAction(plan.id, formData)
      setNewActionTitle("")
      setNewActionDate("")
    } catch (error) {
      console.error(error)
    }
    setLoadingAction(false)
  }

  const handleUpdateStatus = async (actionId: string, status: string) => {
    try {
      await updateActionProgress(actionId, status, plan.id)
    } catch (error) {
      console.error(error)
    }
  }

  const handleAddFollowUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!followUpNote) return
    setLoadingFollowUp(true)
    
    const formData = new FormData()
    formData.append("note", followUpNote)
    formData.append("progress", String(followUpProgress))
    
    try {
      await addFollowUp(plan.id, formData)
      setFollowUpNote("")
      setFollowUpProgress(0)
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
          {plan.actions?.map((action: any) => (
            <div key={action.id} className="p-4 flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground-strong">{action.title}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {action.dueDate ? `المستهدف: ${new Date(action.dueDate).toLocaleDateString('ar-SA')}` : "لا يوجد تاريخ مستهدف"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Select 
                  defaultValue={action.status} 
                  onChange={(e) => handleUpdateStatus(action.id, e.target.value)}
                  className="h-8 text-xs w-32"
                >
                  <option value="PENDING">لم يبدأ</option>
                  <option value="IN_PROGRESS">جارية</option>
                  <option value="COMPLETED">مكتملة</option>
                  <option value="DELAYED">متعثرة</option>
                </Select>
                {action.status === "COMPLETED" && <CheckCircle className="w-4 h-4 text-success" />}
                {action.status === "DELAYED" && <AlertCircle className="w-4 h-4 text-danger" />}
                {action.status === "IN_PROGRESS" && <Clock className="w-4 h-4 text-warning" />}
              </div>
            </div>
          ))}
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
          <div className="flex items-center gap-4">
            <div className="space-y-1 flex-1">
              <label className="text-sm font-medium">نسبة الإنجاز الحالية (%)</label>
              <Input 
                type="number" 
                min="0" 
                max="100" 
                value={followUpProgress} 
                onChange={(e) => setFollowUpProgress(Number(e.target.value))} 
              />
            </div>
            <Button type="submit" disabled={loadingFollowUp} size="md" icon={loadingFollowUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}>
              حفظ المتابعة
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}