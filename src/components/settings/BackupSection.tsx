"use client"

import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { createBackup } from "@/app/(dashboard)/settings/actions"
import { Loader2, Download, Database } from "lucide-react"

export function BackupSection({ history }: { history: any[] }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleBackup = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await createBackup()
      if (result.success && result.data) {
        // إنشاء ملف وتنزيله
        const blob = new Blob([result.data], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = result.filename || "backup.json"
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        
        // تحديث الصفحة لإظهار السجل الجديد
        window.location.reload()
      }
    } catch (err: any) {
      setError(err.message)
    }
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="p-4 bg-surface-muted rounded-lg border border-border">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold text-foreground-strong">مزود قاعدة البيانات</h4>
          <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-1 rounded">Neon PostgreSQL</span>
        </div>
        <p className="text-sm text-muted-foreground">
          يتم إدارة النسخ الاحتياطي التلقائي ونقاط الاستعادة (PITR) بواسطة مزود الخدمة السحابي (Neon). 
          يمكنك إنشاء نسخة تصدير يدوية للبيانات الأساسية (JSON) متى ما أردت.
        </p>
      </div>

      {error && <div className="p-3 bg-danger/10 text-danger rounded-lg text-sm">{error}</div>}

      <div className="flex justify-end">
        <Button onClick={handleBackup} disabled={loading} icon={loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}>
          {loading ? "جاري التصدير..." : "إنشاء نسخة احتياطية الآن (JSON)"}
        </Button>
      </div>

      {/* Backup History */}
      <div className="mt-6">
        <h4 className="text-sm font-bold text-foreground-strong mb-2">سجل العمليات</h4>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد عمليات نسخ احتياطي مسجلة.</p>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm text-right">
              <thead className="bg-surface-muted text-xs text-muted-foreground">
                <tr>
                  <th className="p-2 font-medium">النوع</th>
                  <th className="p-2 font-medium">الحالة</th>
                  <th className="p-2 font-medium">الحجم</th>
                  <th className="p-2 font-medium">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {history.map((h: any) => (
                  <tr key={h.id}>
                    <td className="p-2 flex items-center gap-2"><Database className="w-3 h-3" /> {h.type}</td>
                    <td className="p-2">
                      <span className={h.status === "SUCCESS" ? "text-success font-medium" : "text-danger font-medium"}>
                        {h.status === "SUCCESS" ? "ناجح" : "فشل"}
                      </span>
                    </td>
                    <td className="p-2 numeric">{h.fileSize ? `${(h.fileSize / 1024).toFixed(2)} KB` : "-"}</td>
                    <td className="p-2 text-muted-foreground">{new Date(h.createdAt).toLocaleString('ar-SA')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}