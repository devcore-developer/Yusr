"use client"

import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Modal } from "@/components/ui/Modal"
import { Input } from "@/components/ui/Input"
import { deleteUser } from "@/features/admin/actions"
import { Trash2, AlertTriangle } from "lucide-react"

export function UserDeleteButton({ userId, userName, userEmail }: { userId: string, userName: string, userEmail: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmPhrase, setConfirmPhrase] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleDelete = async () => {
    setIsLoading(true)
    setError("")
    
    const res = await deleteUser(userId, password, confirmPhrase)
    
    if (res?.error) {
      setError(res.error)
      setIsLoading(false)
    } else {
      setIsOpen(false)
      setIsLoading(false)
      setPassword("")
      setConfirmPhrase("")
    }
  }

  const handleClose = () => {
    setIsOpen(false)
    setError("")
    setPassword("")
    setConfirmPhrase("")
  }

  return (
    <>
      <Button 
        variant="ghost" 
        size="icon-sm" 
        aria-label="حذف" 
        onClick={() => setIsOpen(true)}
        className="text-red-500 hover:text-red-700 hover:bg-red-50"
      >
        <Trash2 className="w-4 h-4" />
      </Button>

      <Modal isOpen={isOpen} onClose={handleClose} title="تأكيد حذف المستخدم">
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg text-sm flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">تحذير: عملية لا يمكن التراجع عنها</p>
              <p>أنت على وشك حذف المستخدم "{userName}" ({userEmail}) نهائياً. سيتم احتفاظ السجلات التاريخية (التقييمات، النشاطات) لكن سيتم فك ارتباط الحساب.</p>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">كلمة مرور المسؤول</label>
            <Input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="أدخل كلمة المرور الخاصة بك"
              disabled={isLoading}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">
              اكتب <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-red-600 font-bold">DELETE</span> للتأكيد
            </label>
            <Input 
              value={confirmPhrase} 
              onChange={(e) => setConfirmPhrase(e.target.value)} 
              placeholder="DELETE"
              disabled={isLoading}
              className="font-mono"
            />
          </div>

          {error && <p className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</p>}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleClose} disabled={isLoading}>إلغاء</Button>
            <Button 
              variant="danger" 
              onClick={handleDelete} 
              disabled={isLoading || confirmPhrase !== "DELETE" || !password}
            >
              {isLoading ? "جاري الحذف..." : "حذف نهائي"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}