import { getCurrentUser } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Building2, ShieldCheck, GraduationCap, CalendarDays } from "lucide-react"
import { SecurityForm } from "@/components/settings/SecurityForm"
import { updateBranch } from "../branch-profile/actions"
import { getStageLabel } from "@/lib/stages"
import { AcademicYearManager, type ManagerYearRow } from "@/components/academic-years/AcademicYearManager"
import { suggestAcademicYearStart } from "@/lib/academic-year"

export default async function SettingsPage() {
  const user = await getCurrentUser()
  if (!user?.schoolId) return null

  const isBranchManager = user.role === "BRANCH_MANAGER"
  const isSchoolManager = user.role === "SCHOOL_MANAGER"

  // إدارة الأعوام الدراسية — مدير المدرسة فقط (§1.2): بيانات مدرسته هو فقط
  const yearRows = isSchoolManager
    ? await prisma.academicYear.findMany({
        where: { schoolId: user.schoolId },
        orderBy: { startYear: "desc" },
        select: {
          id: true,
          label: true,
          startYear: true,
          isActive: true,
          _count: { select: { assessments: true, improvementPlans: true } }
        }
      })
    : []
  const managerYears: ManagerYearRow[] = yearRows.map(y => ({
    id: y.id,
    label: y.label,
    startYear: y.startYear,
    isActive: y.isActive,
    assessmentCount: y._count.assessments,
    planCount: y._count.improvementPlans
  }))
  const suggestedStartYear = isSchoolManager ? suggestAcademicYearStart() : null

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="الإعدادات"
        description="إدارة بياناتك الشخصية وبيانات المؤسسة."
        breadcrumbs={[{ label: 'الرئيسية', href: '/' }, { label: 'الإعدادات' }]}
      />
      
      {/* 1. بيانات المؤسسة (تتغير حسب الدور) */}
      {isBranchManager ? (
        <BranchSettingsCard branchId={user.branchId!} />
      ) : (
        <SchoolSettingsCard schoolId={user.schoolId} />
      )}

      {/* 1.4 العام الدراسي الهجري — إدارة مدير المدرسة (عام نشط واحد لكل مدرسة) */}
      {isSchoolManager && (
        <Card variant="primary">
          <CardHeader>
            <CardTitle icon={<CalendarDays className="w-5 h-5" />}>العام الدراسي الهجري</CardTitle>
            <CardDescription>
              إنشاء الأعوام الدراسية لمدرستك وتحديد العام النشط — التقييمات الجديدة ترتبط بالعام النشط وقت إنشائها.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AcademicYearManager
              schoolId={user.schoolId}
              years={managerYears}
              suggestedStartYear={suggestedStartYear}
            />
          </CardContent>
        </Card>
      )}

      {/* 1.5 المراحل التعليمية — عرض فقط (§2): تُدار التعيينات من إدارة المستخدمين */}
      <StageInfoCard
        role={user.role}
        stages={Array.isArray(user.stages) ? user.stages : []}
      />

      {/* 2. الأمان وكلمة المرور */}
      <Card>
        <CardHeader>
          <CardTitle icon={<ShieldCheck className="w-5 h-5" />}>الأمان وكلمة المرور</CardTitle>
        </CardHeader>
        <CardContent>
          <SecurityForm />
        </CardContent>
      </Card>
    </div>
  )
}

// بطاقة المراحل التعليمية للحساب — عرض فقط
function StageInfoCard({ role, stages }: { role: string; stages: string[] }) {
  const unlimited = role === "SUPER_ADMIN" || role === "SCHOOL_MANAGER"
  return (
    <Card>
      <CardHeader>
        <CardTitle icon={<GraduationCap className="w-5 h-5" />}>المراحل التعليمية</CardTitle>
      </CardHeader>
      <CardContent>
        {unlimited ? (
          <p className="text-sm text-muted-foreground">
            حسابك غير مقيّد بمراحل محددة — يمكنك العمل في جميع المراحل التعليمية الخمس.
          </p>
        ) : stages.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {stages.map(s => (
              <Badge key={s} variant="info">{getStageLabel(s)}</Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-warning">
            لم تُعيَّن أي مراحل تعليمية لحسابك بعد — تواصل مع مديرك لتعيين المراحل المسموح لك بتقييمها.
          </p>
        )}
        <p className="text-[12px] text-muted-foreground mt-3">
          تُدار هذه التعيينات من قبل الإدارة عبر صفحة المستخدمين (عرض فقط هنا).
        </p>
      </CardContent>
    </Card>
  )
}

// مكون بيانات المدرسة (لالمدير العام)
async function SchoolSettingsCard({ schoolId }: { schoolId: string }) {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { name: true, location: true, phone: true, officialEmail: true, description: true, status: true },
  })

  if (!school) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle icon={<Building2 className="w-5 h-5" />}>بيانات المدرسة</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">اسم المدرسة</label>
            <Input defaultValue={school.name} readOnly className="bg-surface-muted" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">حالة المدرسة</label>
            <div className="pt-2">
              <Badge variant={school.status === "ACTIVE" ? "success" : "danger"}>
                {school.status === "ACTIVE" ? "نشطة" : "موقوفة"}
              </Badge>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">البريد الرسمي</label>
            <Input defaultValue={school.officialEmail || ""} readOnly className="bg-surface-muted" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">الهاتف</label>
            <Input defaultValue={school.phone || ""} readOnly className="bg-surface-muted" />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-medium">الموقع</label>
            <Input defaultValue={school.location || ""} readOnly className="bg-surface-muted" />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-medium">الوصف</label>
            <Input defaultValue={school.description || ""} readOnly className="bg-surface-muted" />
          </div>
        </div>
        <div className="mt-6 p-4 bg-surface-muted/50 rounded-lg text-sm text-muted-foreground">
          لتعديل البيانات الأساسية للمدرسة (مثل الاسم والشعار)، يرجى التواصل مع إدارة المنصة.
        </div>
      </CardContent>
    </Card>
  )
}

// مكون بيانات الفرع (لمدير قسم)
async function BranchSettingsCard({ branchId }: { branchId: string }) {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    include: { school: { select: { name: true } } }
  })

  if (!branch) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle icon={<Building2 className="w-5 h-5" />}>بيانات الفرع</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={updateBranch} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">اسم الفرع</label>
              <Input name="name" defaultValue={branch.name} required />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">المدرسة التابع لها</label>
              <Input defaultValue={branch.school.name} readOnly className="bg-surface-muted" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">الهاتف</label>
              <Input name="phone" defaultValue={branch.phone || ""} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">الموقع</label>
              <Input name="location" defaultValue={branch.location || ""} />
            </div>
          </div>
          <div className="flex justify-end pt-4">
            <Button type="submit">حفظ التغييرات</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}