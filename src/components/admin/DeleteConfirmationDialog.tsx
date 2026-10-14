"use client"

import { useState } from "react"
import { Modal } from "@/components/ui/Modal"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { deleteSchool, deleteUser } from "@/features/admin/actions"

export function DeleteConfirmationDialog({ 
  isOpen, 
  onClose, 
  type, 
  entityId, 
  entityName 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  type: "school" | "user", 
  entityId: string, 
  entityName: string 
}) {
  const [password, setPassword] = useState("")
  const [confirmPhrase, setConfirmPhrase] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleDelete = async () => {
    setIsLoading(true)
    setError("")
    
    const action = type === "school" ? deleteSchool : deleteUser
    const res = await action(entityId, password, confirmPhrase)
    
    if (res.error) {
      setError(res.error)
      setIsLoading(false)
    } else {
      onClose()
      setIsLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`حذف ${type === "school" ? "المدرسة" : "المستخدم"}`}>
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg text-sm">
          <p className="font-bold">تحذير: عملية لا يمكن التراجع عنها</p>
          <p>أنت على وشك حذف "{entityName}" نهائياً. سيتم حذف جميع البيانات المرتبطة بها.</p>
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium">كلمة مرور المسؤول</label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium">اكتب <span className="font-mono bg-slate-100 px-1 rounded">DELETE</span> للتأكيد</label>
          <Input value={confirmPhrase} onChange={(e) => setConfirmPhrase(e.target.value)} />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>إلغاء</Button>
          <Button variant="danger" onClick={handleDelete} disabled={isLoading || confirmPhrase !== "DELETE" || !password}>
            {isLoading ? "جاري الحذف..." : "حذف نهائي"}
          </Button>
        </div>
      </div>
    </Modal>
  )
}