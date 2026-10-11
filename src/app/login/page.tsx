"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { GraduationCap, Eye, EyeOff, AlertCircle, Loader2 } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    const result = await signIn("credentials", { email, password, redirect: false })

    if (result?.error) {
      setError("بيانات الدخول غير صحيحة. تأكد من البريد الإلكتروني وكلمة المرور.")
      setLoading(false)
    } else {
      // Hard redirect to ensure session is available
      window.location.href = "/"
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-primary">
      {/* Decorative background */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-secondary blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-secondary blur-[100px]" />
      </div>

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      />

      <div className="relative w-full max-w-[420px]">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="bg-secondary p-3 rounded-2xl shadow-lg shadow-secondary/30 mb-4">
            <GraduationCap className="w-8 h-8 text-white" strokeWidth={2.2} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">YUSR</h1>
          <p className="text-[13px] text-primary-100/60 mt-1">منصة إدارة الجودة التعليمية</p>
        </div>

        {/* Card */}
        <div className="bg-surface rounded-2xl shadow-xl p-7 lg:p-8 border border-border/50">
          <h2 className="text-lg font-semibold text-foreground-strong text-center mb-1">تسجيل الدخول</h2>
          <p className="text-[13px] text-muted-foreground text-center mb-6">أدخل بياناتك للوصول إلى لوحة التحكم</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-start gap-2 p-3 bg-danger/5 border border-danger/20 rounded-lg">
                <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
                <p className="text-[13px] text-danger">{error}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-foreground-strong">البريد الإلكتروني</label>
              <Input
                name="email"
                type="email"
                required
                placeholder="admin@yusr.com"
                className="h-11"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-foreground-strong">كلمة المرور</label>
              <div className="relative">
                <Input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  className="h-11 pl-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-smooth"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" size="lg" className="w-full mt-2" loading={loading}>
              {loading ? "جاري التحقق..." : "دخول"}
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-border text-center">
            <p className="text-[12px] text-muted-foreground">
              منصة مؤسسية لإدارة جودة المدارس والتقييمات
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}