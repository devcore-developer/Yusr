import Link from "next/link"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/permissions"
import { Button } from "@/components/ui/Button"
import { ContactForm } from "@/components/landing/ContactForm"
import Image from "next/image"
import {
  ClipboardCheck, Building2, 
  Hash, Wrench, Calendar, ChevronDown, FileText, AlertTriangle,
  GraduationCap, ArrowLeft
} from "lucide-react"

export const metadata = {
  title: "يُسر | منصة إدارة الجودة التعليمية",
  description: "منصة يُسر لإدارة تقييمات الجودة التعليمية، وتحليل الفجوات، ومتابعة خطط التحسين للمؤسسات التعليمية.",
}

export default async function LandingPage() {
  const user = await getCurrentUser()
  if (user) {
    if (user.role === "SUPER_ADMIN") redirect("/dashboard")
    if (user.role === "SCHOOL_MANAGER" || user.role === "BRANCH_MANAGER") redirect("/school-manager")
    if (user.role === "QUALITY_ASSESSOR") redirect("/quality-assessor")
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 bg-surface/90 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/* Logo Image */}
            <div className="relative w-8 h-8">
              <Image src="/logo.png" alt="YUSR Logo" fill className="object-contain" priority />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-lg font-bold tracking-tight text-foreground-strong">YUSR</span>
              <span className="text-[10px] text-muted-foreground mt-0.5">إدارة الجودة التعليمية</span>
            </div>
          </div>
          
          <nav className="hidden md:flex items-center gap-10">
            <Link href="#about" className="text-sm font-medium text-muted-foreground hover:text-foreground-strong transition-smooth">عن المنصة</Link>
            <Link href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground-strong transition-smooth">المميزات</Link>
            <Link href="#contact" className="text-sm font-medium text-muted-foreground hover:text-foreground-strong transition-smooth">تواصل معنا</Link>
          </nav>

          <Button asChild variant="primary" size="md">
            <Link href="/login">تسجيل الدخول</Link>
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-primary text-white">
        <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32 relative">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8 text-center lg:text-right">
              <span className="inline-block px-4 py-1.5 text-xs font-semibold bg-secondary/20 text-secondary rounded-full border border-secondary/30">
                منصة يُسر لإدارة الجودة التعليمية
              </span>
              <h1 className="text-[2.625rem] md:text-[3.25rem] font-bold leading-[1.3] tracking-tight text-white">
                نحو جودة تعليمية أفضل، بقرارات مبنية على البيانات
              </h1>
              <p className="text-lg md:text-[1.125rem] text-primary-100/80 leading-[1.9] max-w-xl mx-auto lg:mx-0">
                منصة متكاملة تساعد المؤسسات التعليمية على تنظيم تقييمات الجودة، ومتابعة المؤشرات، وتحديد الفجوات، وإدارة خطط التحسين من خلال تجربة واضحة ومركزية.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-2">
                <Button asChild size="lg" variant="secondary">
                  <Link href="/login">تسجيل الدخول <ArrowLeft className="w-4 h-4" /></Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="bg-transparent border-white/40 text-white hover:bg-white/10 hover:text-white">
                  <Link href="#features">تعرّف على المنصة</Link>
                </Button>
              </div>
            </div>
            
            <div className="hidden lg:block relative">
              <div className="absolute inset-0 bg-secondary/20 blur-3xl rounded-full"></div>
              <div className="relative bg-surface rounded-xl shadow-2xl p-4 border border-white/10">
                <div className="flex gap-4 h-96">
                  <div className="w-1/4 bg-primary-50 rounded-lg p-3 space-y-3">
                    <div className="h-4 bg-primary/20 rounded w-3/4"></div>
                    <div className="h-3 bg-primary-100 rounded w-1/2"></div>
                    <div className="space-y-2 mt-4">
                      <div className="h-2.5 bg-surface-muted rounded"></div>
                      <div className="h-2.5 bg-secondary/30 rounded w-5/6"></div>
                      <div className="h-2.5 bg-surface-muted rounded w-4/6"></div>
                      <div className="h-2.5 bg-surface-muted rounded"></div>
                      <div className="h-2.5 bg-secondary/30 rounded w-3/4"></div>
                    </div>
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="h-32 bg-surface-muted rounded-lg flex items-center justify-center relative overflow-hidden">
                      <div className="absolute bottom-0 left-0 right-0 h-24 flex items-end justify-around p-4 gap-2">
                        <div className="w-1/4 h-12 bg-primary/20 rounded-t"></div>
                        <div className="w-1/4 h-20 bg-secondary/40 rounded-t"></div>
                        <div className="w-1/4 h-16 bg-primary/30 rounded-t"></div>
                        <div className="w-1/4 h-10 bg-success/30 rounded-t"></div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="h-32 bg-success/5 border border-success/10 rounded-lg p-4 flex flex-col justify-end">
                        <div className="h-2 bg-success/30 rounded w-1/2 mb-2"></div>
                        <div className="h-5 bg-success/50 rounded w-3/4"></div>
                      </div>
                      <div className="h-32 bg-secondary/5 border border-secondary/10 rounded-lg p-4 flex flex-col justify-end">
                        <div className="h-2 bg-secondary/30 rounded w-1/2 mb-2"></div>
                        <div className="h-5 bg-secondary/50 rounded w-3/4"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Introduction */}
      <section id="about" className="py-24 md:py-32 bg-surface">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h2 className="text-[1.75rem] md:text-[2.125rem] font-bold text-foreground-strong leading-snug">إدارة الجودة التعليمية في مكان واحد</h2>
          <p className="text-lg text-muted-foreground leading-[1.9]">
            تجمع يُسر أدوات التقييم والتحليل والمتابعة في تجربة واحدة تساعد فرق العمل على تنظيم البيانات وفهم النتائج ومتابعة إجراءات التحسين.
          </p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 md:py-32 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-[1.75rem] md:text-[2.125rem] font-bold text-foreground-strong">مميزات المنصة</h2>
            <p className="text-lg text-muted-foreground mt-3">أدوات مصممة لدعم رحلة التحسين المستمر</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <div key={i} className="bg-surface border border-border rounded-xl p-8 shadow-premium hover:shadow-md hover:border-secondary/30 transition-all duration-300">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
                  <f.icon className="w-6 h-6 text-primary" strokeWidth={2} />
                </div>
                <h3 className="text-lg font-bold text-foreground-strong mb-3">{f.title}</h3>
                <p className="text-[15px] text-muted-foreground leading-[1.8]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 md:py-32 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-[1.75rem] md:text-[2.125rem] font-bold text-foreground-strong">كيف تعمل المنصة؟</h2>
          </div>
          <div className="relative grid md:grid-cols-3 gap-12">
            <div className="hidden md:block absolute top-8 right-[16.66%] left-[16.66%] h-0.5 bg-border"></div>
            {steps.map((s, i) => (
              <div key={i} className="relative text-center">
                <div className="relative z-10 w-16 h-16 mx-auto rounded-full bg-surface border-2 border-secondary flex items-center justify-center mb-6 text-xl font-bold text-secondary shadow-sm">
                  {i + 1}
                </div>
                <h3 className="text-lg font-bold text-foreground-strong mb-3">{s.title}</h3>
                <p className="text-[15px] text-muted-foreground leading-[1.8] max-w-xs mx-auto">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-primary text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8 relative">
          <h2 className="text-[1.75rem] md:text-[2.125rem] font-bold text-white leading-snug">ابدأ رحلتك نحو إدارة أكثر وضوحًا للجودة التعليمية</h2>
          <p className="text-lg text-primary-100/80 max-w-2xl mx-auto leading-[1.9]">استخدم منصة يُسر للوصول إلى أدوات إدارة التقييمات وتحليل النتائج ومتابعة التحسين.</p>
          <div className="pt-2">
            <Button asChild size="lg" variant="secondary">
              <Link href="/login">تسجيل الدخول</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-24 md:py-32 bg-background">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-[1.75rem] md:text-[2.125rem] font-bold text-foreground-strong">تواصل مع إدارة منصة يُسر</h2>
            <p className="text-lg text-muted-foreground mt-3 leading-[1.9]">للاستفسارات حول المنصة أو طلب المعلومات، يمكنك التواصل مع إدارة يُسر من خلال النموذج التالي.</p>
          </div>
          <div className="bg-surface border border-border rounded-xl shadow-premium p-6 md:p-10">
            <ContactForm />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-primary-900 text-primary-100/70 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="relative w-8 h-8">
                <Image src="/logo.png" alt="YUSR Logo" fill className="object-contain" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-lg font-bold text-white">YUSR</span>
                <span className="text-[10px] text-primary-100/50 mt-0.5">منصة إدارة الجودة التعليمية</span>
              </div>
            </div>
            <nav className="flex flex-wrap justify-center gap-8 text-sm">
              <Link href="/" className="hover:text-white transition-smooth">الرئيسية</Link>
              <Link href="#features" className="hover:text-white transition-smooth">المميزات</Link>
              <Link href="#contact" className="hover:text-white transition-smooth">تواصل معنا</Link>
              <Link href="/login" className="hover:text-white transition-smooth">تسجيل الدخول</Link>
            </nav>
          </div>
          <div className="border-t border-white/10 mt-8 pt-8 text-center text-[13px]">
            © {new Date().getFullYear()} منصة يُسر - جميع الحقوق محفوظة.
          </div>
        </div>
      </footer>
    </div>
  )
}

const features = [
  { icon: ClipboardCheck, title: "تقييمات الجودة", desc: "تنظيم المؤشرات ومتابعة تقدم التقييمات والردود." },
  { icon: AlertTriangle, title: "تحليل الفجوات", desc: "متابعة المؤشرات غير المتحققة والفجوات المسجلة وفق قواعد النظام." },
  { icon: FileText, title: "خطط التحسين", desc: "تنظيم إجراءات التحسين والمسؤوليات والمواعيد والمتابعة." },
  { icon: Building2, title: "إدارة المدارس والفروع", desc: "إدارة المدارس والفروع والمستخدمين وفق الصلاحيات." },
]

const steps = [
  { title: "تنظيم البيانات", desc: "إدارة المدارس والفروع والمستخدمين والصلاحيات." },
  { title: "تنفيذ التقييمات", desc: "متابعة مؤشرات الجودة وتسجيل الاستجابات والأدلة المتاحة." },
  { title: "التحليل والتحسين", desc: "مراجعة النتائج والفجوات وتنظيم خطط التحسين." },
]