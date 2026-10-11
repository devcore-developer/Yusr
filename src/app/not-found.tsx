import Link from "next/link"
import { Button } from "@/components/ui/Button"

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-bold text-primary">404</h1>
        <h2 className="text-xl font-semibold">الصفحة غير موجودة</h2>
        <p className="text-muted-foreground">قد تكون الصفحة قد تم نقلها أو حذفها أو غير متاحة حالياً.</p>
        <Link href="/">
          <Button className="mt-4">العودة للرئيسية</Button>
        </Link>
      </div>
    </div>
  )
}