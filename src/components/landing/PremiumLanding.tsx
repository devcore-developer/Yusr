import Link from "next/link"
import { ContactForm } from "@/components/landing/ContactForm"
import {
  GraduationCap, ArrowLeft, ClipboardCheck, AlertTriangle, FileCheck,
  BarChart3, ShieldCheck, Database, CheckCircle, Mail
} from "lucide-react"
import Image from "next/image"

export function PremiumLanding() {
  return (
    <div className="min-h-screen bg-white text-slate-800 font-sans antialiased">
      
      {/* ===== Header & Navigation ===== */}
      <header className="sticky top-0 z-50 bg-[#073B43]/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative w-8 h-8">
              <Image src="/logo.png" alt="YUSR Logo" fill className="object-contain rounded-lg" priority />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-lg font-bold tracking-tight text-white">YUSR</span>
              <span className="text-[10px] text-cyan-300 mt-0.5">إدارة الجودة التعليمية</span>
            </div>
          </div>
          
          <nav className="hidden md:flex items-center gap-10">
            <Link href="#features" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">المميزات</Link>
            <Link href="#how-it-works" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">كيف تعمل المنصة</Link>
            <Link href="#contact" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">تواصل معنا</Link>
          </nav>

          <Link href="/login" className="inline-flex items-center justify-center gap-2 h-9 px-5 text-sm font-medium rounded-md bg-cyan-500 text-white hover:bg-cyan-600 transition-colors">
            تسجيل الدخول
          </Link>
        </div>
      </header>

      {/* ===== Hero Section ===== */}
      <section className="relative overflow-hidden bg-[#073B43] text-white">
        <div className="absolute top-0 left-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8 text-center lg:text-right">
              <h1 className="text-4xl md:text-5xl font-bold leading-tight tracking-tight text-white">
                حوّل بيانات الجودة إلى <span className="text-cyan-400">قرارات تصنع التميز</span>
              </h1>
              <p className="text-lg text-slate-300 leading-relaxed max-w-xl mx-auto lg:mx-0">
                منصة متكاملة تساعد المؤسسات التعليمية على تنظيم التقييمات، وجمع وتحليل البيانات، وتحديد الفجوات، وإدارة خطط التحسين ومتابعة النتائج.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link href="/login" className="inline-flex items-center justify-center gap-2 h-12 px-8 text-base font-medium rounded-lg bg-cyan-500 text-white hover:bg-cyan-600 transition-colors shadow-lg shadow-cyan-500/20">
                  ابدأ الآن <ArrowLeft className="w-4 h-4" />
                </Link>
                <Link href="#features" className="inline-flex items-center justify-center gap-2 h-12 px-8 text-base font-medium rounded-lg bg-transparent border border-slate-500 text-white hover:bg-white/10 transition-colors">
                  تعرّف على المنصة
                </Link>
              </div>
              
              <div className="flex flex-wrap gap-x-6 gap-y-3 pt-4 justify-center lg:justify-start">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" /> 50 مؤشر جودة
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Database className="w-4 h-4 text-cyan-400" /> 7 أدوات لجمع الشواهد
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <BarChart3 className="w-4 h-4 text-cyan-400" /> تحليل الفجوات
                </div>
              </div>
            </div>
            
            {/* Hero Image */}
            <div className="hidden lg:block relative">
              <div className="absolute inset-0 bg-cyan-500/20 blur-3xl rounded-full"></div>
              <div className="relative rounded-2xl shadow-2xl border border-white/10 overflow-hidden">
                <Image 
                  src="/hero-image.png" 
                  alt="YUSR Platform Dashboard" 
                  width={600} 
                  height={400} 
                  className="w-full h-auto object-cover"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Trust Strip ===== */}
      <section className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { icon: ClipboardCheck, title: "تقييمات دقيقة", desc: "أدوات تقييم معتمدة" },
              { icon: AlertTriangle, title: "تحليل فجوات", desc: "تحديد نقاط الضعف" },
              { icon: FileCheck, title: "خطط تحسين", desc: "متابعة الإجراءات" },
              { icon: BarChart3, title: "تقارير ذكية", desc: "رؤى لاتخاذ القرار" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-cyan-50 flex items-center justify-center text-cyan-600">
                  <item.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                  <p className="text-xs text-slate-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Features Section ===== */}
      <section id="features" className="py-20 md:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900">كل أدوات إدارة الجودة في مساحة واحدة</h2>
            <p className="text-lg text-slate-500 mt-4 max-w-2xl mx-auto">منصة تربط بين التقييم، والشواهد، وتحليل الفجوات، وخطط التحسين في تجربة سلسة.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-[#073B43] flex items-center justify-center text-cyan-400 mb-5">
                <ClipboardCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">التقييمات</h3>
              <p className="text-sm text-slate-500 leading-relaxed">تنظيم المؤشرات ومتابعة تقدم التقييمات وتسجيل الاستجابات بدقة.</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-[#073B43] flex items-center justify-center text-cyan-400 mb-5">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">تحليل الفجوات</h3>
              <p className="text-sm text-slate-500 leading-relaxed">تحديد المؤشرات غير المتحققة تلقائياً ووضع خطة لمعالجتها.</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-[#073B43] flex items-center justify-center text-cyan-400 mb-5">
                <FileCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">خطط التحسين</h3>
              <p className="text-sm text-slate-500 leading-relaxed">بناء خطط عمل تفصيلية، وإسناد المهام، ومتابعة التنفيذ خطوة بخطوة.</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-[#073B43] flex items-center justify-center text-cyan-400 mb-5">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">التقارير الذكية</h3>
              <p className="text-sm text-slate-500 leading-relaxed">تقارير شاملة وتحليلات مرئية تساعد القيادة على اتخاذ قرارات مدعومة بالبيانات.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Analytics Section ===== */}
      <section className="py-20 md:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900">رؤية أعمق لأداء مؤسستك</h2>
              <p className="text-lg text-slate-500 leading-relaxed">
                لا تكتفي بجمع البيانات، بل استخرج منها قيمة فورية. تابع مؤشرات الأداء، وحدد مجالات التحسين، وقِس أثر الخطط التنفيذية في زمانك.
              </p>
              <ul className="space-y-4">
                {[
                  "مؤشرات أداء رئيسية (KPIs) محدثة لحظياً",
                  "تحليل بصري لنسب التحقق والفجوات",
                  "متابعة تقدم خطط التحسين والمبادرات",
                  "تقارير قابلة للتصدير والمشاركة بضغطة زر"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-600">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                    <span className="text-slate-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-slate-900">نظرة عامة على الأداء</h3>
                <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">ممتاز</div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-white p-4 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-400 mb-1">نسبة التحقق</p>
                  <p className="text-2xl font-bold text-slate-900">85%</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-400 mb-1">فجوات مفتوحة</p>
                  <p className="text-2xl font-bold text-red-500">4</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-400 mb-1">خطط نشطة</p>
                  <p className="text-2xl font-bold text-cyan-600">7</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500">الإدارة المدرسية</span>
                    <span className="font-bold text-slate-700">90%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div className="bg-cyan-500 h-2 rounded-full" style={{ width: '90%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500">التعليم والتعلم</span>
                    <span className="font-bold text-slate-700">75%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div className="bg-cyan-500 h-2 rounded-full" style={{ width: '75%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500">البيئة المدرسية</span>
                    <span className="font-bold text-slate-700">95%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div className="bg-cyan-500 h-2 rounded-full" style={{ width: '95%' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== How It Works ===== */}
      <section id="how-it-works" className="py-20 md:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900">كيف تعمل المنصة؟</h2>
            <p className="text-lg text-slate-500 mt-4">ثلاث خطوات بسيطة لبدء رحلة التحسين المستمر.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-8 right-[16.66%] left-[16.66%] h-0.5 bg-slate-200"></div>
            
            {[
              { num: "1", title: "تنظيم البيانات", desc: "إدخال التقييمات وجمع الشواهد باستخدام الأدوات المعتمدة." },
              { num: "2", title: "تنفيذ التقييمات", desc: "تقييم المؤشرات وتحليل النتائج وتحديد الفجوات بدقة." },
              { num: "3", title: "التحليل والتحسين", desc: "متابعة خطط التحسين وقياس الأثر على الأداء العام." }
            ].map((step, i) => (
              <div key={i} className="relative text-center">
                <div className="relative z-10 w-16 h-16 mx-auto rounded-full bg-white border-2 border-cyan-500 flex items-center justify-center mb-6 text-xl font-bold text-cyan-600 shadow-sm">
                  {step.num}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{step.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA Section ===== */}
      <section className="py-20 bg-[#073B43] text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl"></div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8 relative">
          <h2 className="text-3xl md:text-4xl font-bold text-white">ابدأ رحلتك نحو إدارة أكثر وضوحًا للجودة التعليمية</h2>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto">انضم إلى المنصات التعليمية التي تتبنى يُسر لتحقيق جودة مستدامة.</p>
          <Link href="/login" className="inline-flex items-center justify-center gap-2 h-12 px-8 text-base font-medium rounded-lg bg-cyan-500 text-white hover:bg-cyan-600 transition-colors shadow-lg shadow-cyan-500/20">
            سجل الدخول الآن
          </Link>
        </div>
      </section>

      {/* ===== Contact Section ===== */}
      <section id="contact" className="py-20 md:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12">
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900">تواصل معنا</h2>
              <p className="text-lg text-slate-500 leading-relaxed">
                هل لديك أسئلة حول المنصة؟ فريقنا جاهز لمساعدتك في رحلتك نحو التميز.
              </p>
              <div className="space-y-4 pt-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                    <Mail className="w-5 h-5" />
                  </div>
                  <span className="text-slate-700">support@yusr-platform.com</span>
                </div>
              </div>
            </div>
            <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100">
              <ContactForm />
            </div>
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="bg-[#073B43] text-slate-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="relative w-8 h-8">
                <Image src="/logo.png" alt="YUSR Logo" fill className="object-contain rounded-lg" />
              </div>
              <span className="text-lg font-bold text-white">YUSR</span>
            </div>
            <nav className="flex flex-wrap justify-center gap-8 text-sm">
              <Link href="/" className="hover:text-white transition-colors">الرئيسية</Link>
              <Link href="#features" className="hover:text-white transition-colors">المميزات</Link>
              <Link href="#contact" className="hover:text-white transition-colors">تواصل معنا</Link>
              <Link href="/login" className="hover:text-white transition-colors">تسجيل الدخول</Link>
            </nav>
          </div>
          <div className="border-t border-white/10 mt-8 pt-8 text-center text-sm">
            © {new Date().getFullYear()} منصة يُسر - جميع الحقوق محفوظة.
          </div>
        </div>
      </footer>

    </div>
  )
}