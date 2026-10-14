"use client"
import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge, StatusBadge, PriorityBadge } from "@/components/ui/Badge"
import { Progress } from "@/components/ui/Progress"
import { Tabs } from "@/components/ui/Tabs"
import { Modal } from "@/components/ui/Modal"
import { Input } from "@/components/ui/Input"
import { Textarea } from "@/components/ui/Textarea"
import { Avatar } from "@/components/ui/Avatar"
import { EmptyState } from "@/components/ui/EmptyState"
import { useToast } from "@/components/ui/Toast"
import { formatDate, formatRelativeTime } from "@/lib/utils"
import {
  deleteSchoolAction, renewSubscriptionAction,
  suspendSchoolAction, activateSchoolAction, updateSchoolAction
} from "./actions"
import {
  Building2, Users, ClipboardCheck, CreditCard, MapPin, Phone, Mail, Calendar,
  AlertTriangle, ArrowRight, Trash2, Pencil, Pause, Play, RefreshCw, Plus,
  Activity as ActivityIcon, FileText, CheckCircle2, Clock, Save
} from "lucide-react"

interface SchoolProfileProps {
  school: any
  branches: any[]
  users: any[]
  assessments: any[]
  subscription: any
  activities: any[]
  gaps: any[]
  plans: any[]
}

export function SchoolProfile({ school, branches, users, assessments, subscription, activities, gaps, plans }: SchoolProfileProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = React.useState("overview")
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [actionPending, setActionPending] = React.useState(false)

  // Fix: daysRemaining from string dates
  const daysRemaining = subscription
    ? Math.ceil((new Date(subscription.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  const handleDelete = async () => {
    setActionPending(true)
    try {
      await deleteSchoolAction(school.id)
      toast({ variant: "success", title: "تم حذف المدرسة" })
    } catch {
      toast({ variant: "error", title: "فشل الحذف" })
    }
  }

  const handleRenew = async () => {
    if (!subscription) return
    setActionPending(true)
    try {
      await renewSubscriptionAction(subscription.id, school.id)
      toast({ variant: "success", title: "تم تجديد الاشتراك" })
      router.refresh()
    } catch {
      toast({ variant: "error", title: "فشل التجديد" })
    }
    setActionPending(false)
  }

  const handleSuspend = async () => {
    setActionPending(true)
    try {
      await suspendSchoolAction(school.id)
      toast({ variant: "warning", title: "تم تعليق المدرسة" })
      router.refresh()
    } catch {
      toast({ variant: "error", title: "فشل التعليق" })
    }
    setActionPending(false)
  }

  const handleActivate = async () => {
    setActionPending(true)
    try {
      await activateSchoolAction(school.id)
      toast({ variant: "success", title: "تم تفعيل المدرسة" })
      router.refresh()
    } catch {
      toast({ variant: "error", title: "فشل التفعيل" })
    }
    setActionPending(false)
  }

  const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setActionPending(true)
    const formData = new FormData(e.currentTarget)
    try {
      await updateSchoolAction(school.id, formData)
      toast({ variant: "success", title: "تم تحديث بيانات المدرسة" })
      setEditOpen(false)
      router.refresh()
    } catch {
      toast({ variant: "error", title: "فشل التحديث" })
    }
    setActionPending(false)
  }

  const tabs = [
    { value: 'overview', label: 'نظرة عامة' },
    { value: 'branches', label: `الفروع (${branches.length})` },
    { value: 'users', label: `المستخدمون (${users.length})` },
    { value: 'assessments', label: `التقييمات (${assessments.length})` },
    { value: 'gaps', label: `الفجوات (${gaps.length})` },
    { value: 'plans', label: `خطط التحسين (${plans.length})` },
    { value: 'activity', label: 'النشاطات' },
  ]

  return (
    <div className="space-y-6">
      {/* ===== Profile Header ===== */}
      <Card variant="primary" className="overflow-hidden">
        <div className="p-5 lg:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl shrink-0">
                {school.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-page-title text-foreground-strong">{school.name}</h1>
                  <StatusBadge status={school.status} />
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
                  <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {school.location}</span>
                  <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {school.phone}</span>
                  <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {school.email}</span>
                  {subscription && (
                    <span className="flex items-center gap-1">
                      <CreditCard className="w-3.5 h-3.5" /> {subscription.plan}
                      {daysRemaining !== null && daysRemaining <= 7 && (
                        <Badge variant="warning" className="mr-1">ينتهي خلال {daysRemaining} يوم</Badge>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Link href="/schools">
                <Button variant="ghost" size="md" icon={<ArrowRight className="w-4 h-4" />}>رجوع</Button>
              </Link>
              <Button variant="outline" size="md" icon={<Pencil className="w-4 h-4" />} onClick={() => setEditOpen(true)}>
                تعديل
              </Button>
              {school.status === 'ACTIVE' ? (
                <Button variant="outline" size="md" icon={<Pause className="w-4 h-4" />} onClick={handleSuspend} disabled={actionPending}>
                  تعليق
                </Button>
              ) : (
                <Button variant="outline" size="md" icon={<Play className="w-4 h-4" />} onClick={handleActivate} disabled={actionPending}>
                  تفعيل
                </Button>
              )}
              <Button variant="danger" size="md" icon={<Trash2 className="w-4 h-4" />} onClick={() => setDeleteOpen(true)}>
                حذف
              </Button>
            </div>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-x-reverse divide-border border-t border-border">
          <div className="p-4 lg:p-5 flex items-center gap-3">
            <div className="tint-info w-10 h-10 rounded-lg flex items-center justify-center"><Building2 className="w-5 h-5" /></div>
            <div><p className="text-[12px] text-muted-foreground">الفروع</p><p className="text-xl font-bold text-foreground-strong numeric">{branches.length}</p></div>
          </div>
          <div className="p-4 lg:p-5 flex items-center gap-3">
            <div className="tint-violet w-10 h-10 rounded-lg flex items-center justify-center"><Users className="w-5 h-5" /></div>
            <div><p className="text-[12px] text-muted-foreground">المستخدمون</p><p className="text-xl font-bold text-foreground-strong numeric">{users.length}</p></div>
          </div>
          <div className="p-4 lg:p-5 flex items-center gap-3">
            <div className="tint-amber w-10 h-10 rounded-lg flex items-center justify-center"><ClipboardCheck className="w-5 h-5" /></div>
            <div><p className="text-[12px] text-muted-foreground">التقييمات</p><p className="text-xl font-bold text-foreground-strong numeric">{assessments.length}</p></div>
          </div>
          <div className="p-4 lg:p-5 flex items-center gap-3">
            <div className="tint-danger w-10 h-10 rounded-lg flex items-center justify-center"><AlertTriangle className="w-5 h-5" /></div>
            <div><p className="text-[12px] text-muted-foreground">فجوات مفتوحة</p><p className="text-xl font-bold text-foreground-strong numeric">{gaps.filter((g: any) => g.status === 'OPEN').length}</p></div>
          </div>
        </div>
      </Card>

      {/* ===== Tabs ===== */}
      <Tabs items={tabs} value={activeTab} onChange={setActiveTab} />

      {/* ===== Overview Tab ===== */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>معلومات أساسية</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-x-8 gap-y-5">
              <InfoField label="الوصف" value={school.description || 'لا يوجد وصف'} />
              <InfoField label="الحالة" value={<StatusBadge status={school.status} />} />
              {/* FIX: removed .toISOString() */}
              <InfoField label="تاريخ التسجيل" value={formatDate(school.createdAt)} />
              <InfoField label="الهاتف" value={school.phone} />
              <InfoField label="البريد الإلكتروني" value={school.email} />
              <InfoField label="الموقع" value={school.location} />
            </CardContent>
          </Card>

          {subscription ? (
            <Card>
              <CardHeader><CardTitle icon={<CreditCard className="w-5 h-5" />}>الاشتراك</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-surface-muted">
                  <div><p className="text-[12px] text-muted-foreground">الباقة</p><p className="text-lg font-bold text-foreground-strong">{subscription.plan}</p></div>
                  <StatusBadge status={subscription.status} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {/* FIX: removed .toISOString() */}
                  <div className="border border-border rounded-lg p-3"><p className="text-[11px] text-muted-foreground">تاريخ البدء</p><p className="text-sm font-medium mt-1">{formatDate(subscription.startDate)}</p></div>
                  <div className="border border-border rounded-lg p-3"><p className="text-[11px] text-muted-foreground">تاريخ الانتهاء</p><p className="text-sm font-medium mt-1">{formatDate(subscription.endDate)}</p></div>
                </div>
                {daysRemaining !== null && (
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <span className="text-[13px] text-muted-foreground">الأيام المتبقية</span>
                    <span className={`text-sm font-bold numeric ${daysRemaining <= 7 ? 'text-danger' : daysRemaining <= 30 ? 'text-warning' : 'text-success'}`}>{daysRemaining} يوم</span>
                  </div>
                )}
                <Button variant="outline" size="md" icon={<RefreshCw className="w-4 h-4" />} onClick={handleRenew} disabled={actionPending} className="w-full">تجديد الاشتراك</Button>
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent><EmptyState icon={<CreditCard />} title="لا يوجد اشتراك" description="لم يتم تسجيل اشتراك لهذه المدرسة بعد." compact /></CardContent></Card>
          )}
        </div>
      )}

      {/* ===== Branches Tab ===== */}
      {activeTab === 'branches' && (
        <Card>
          <CardHeader><CardTitle icon={<Building2 className="w-5 h-5" />}>فروع المدرسة</CardTitle><CardDescription>{branches.length} فرع مسجل</CardDescription></CardHeader>
          <CardContent className="p-0">
            {branches.length === 0 ? (
              <EmptyState icon={<Building2 />} title="لا توجد فروع" description="لم تتم إضافة فروع لهذه المدرسة بعد." compact />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right">
                  <thead className="text-[12px] text-muted-foreground bg-surface-muted">
                    <tr><th className="px-4 py-3 font-medium">الفرع</th><th className="px-4 py-3 font-medium">الموقع</th><th className="px-4 py-3 font-medium">المدير</th><th className="px-4 py-3 font-medium">المستخدمون</th><th className="px-4 py-3 font-medium">الحالة</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {branches.map((b: any) => (
                      <tr key={b.id} className="hover:bg-surface-muted transition-smooth">
                        <td className="px-4 py-3.5 font-medium text-foreground-strong">{b.name}</td>
                        <td className="px-4 py-3.5 text-muted-foreground">{b.location}</td>
                        <td className="px-4 py-3.5 text-muted-foreground">{b.manager?.name ?? 'غير محدد'}</td>
                        <td className="px-4 py-3.5 numeric text-muted-foreground">{b._count.users}</td>
                        <td className="px-4 py-3.5"><StatusBadge status={b.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ===== Users Tab ===== */}
      {activeTab === 'users' && (
        <Card>
          <CardHeader><CardTitle icon={<Users className="w-5 h-5" />}>مستخدمو المدرسة</CardTitle><CardDescription>{users.length} مستخدم مسجل</CardDescription></CardHeader>
          <CardContent className="p-0">
            {users.length === 0 ? (
              <EmptyState icon={<Users />} title="لا يوجد مستخدمون" compact />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right">
                  <thead className="text-[12px] text-muted-foreground bg-surface-muted">
                    <tr><th className="px-4 py-3 font-medium">المستخدم</th><th className="px-4 py-3 font-medium">الدور</th><th className="px-4 py-3 font-medium">الفرع</th><th className="px-4 py-3 font-medium">الحالة</th><th className="px-4 py-3 font-medium">التسجيل</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {users.map((u: any) => (
                      <tr key={u.id} className="hover:bg-surface-muted transition-smooth">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar name={u.name} size="sm" />
                            <div><p className="font-medium text-foreground-strong">{u.name}</p><p className="text-[12px] text-muted-foreground">{u.email}</p></div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge variant={u.role === 'SCHOOL_MANAGER' ? 'info' : u.role === 'BRANCH_MANAGER' ? 'violet' : u.role === 'QUALITY_ASSESSOR' ? 'amber' : 'neutral'}>
                            {u.role === 'SCHOOL_MANAGER' ? 'مدير مدرسة' : u.role === 'BRANCH_MANAGER' ? 'مدير فرع' : u.role === 'QUALITY_ASSESSOR' ? 'مشرف' : 'مستخدم'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground">{u.branch?.name ?? 'كامل المدرسة'}</td>
                        <td className="px-4 py-3.5"><StatusBadge status={u.status} /></td>
                        {/* FIX: removed .toISOString() */}
                        <td className="px-4 py-3.5 text-muted-foreground numeric">{formatDate(u.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ===== Assessments Tab ===== */}
      {activeTab === 'assessments' && (
        <Card>
          <CardHeader><CardTitle icon={<ClipboardCheck className="w-5 h-5" />}>تقييمات المدرسة</CardTitle><CardDescription>{assessments.length} تقييم</CardDescription></CardHeader>
          <CardContent className="p-0">
            {assessments.length === 0 ? (
              <EmptyState icon={<ClipboardCheck />} title="لا توجد تقييمات" compact />
            ) : (
              <ul className="divide-y divide-border">
                {assessments.map((a: any) => (
                  <li key={a.id} className="flex items-center gap-4 p-4 hover:bg-surface-muted transition-smooth">
                    <div className="w-10 h-10 rounded-lg bg-surface-muted flex items-center justify-center shrink-0"><ClipboardCheck className="w-5 h-5 text-muted-foreground" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground-strong">{a.branch?.name ?? 'كامل المدرسة'}</p>
                      <p className="text-[12px] text-muted-foreground">المقيّم: {a.assessor.name}</p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="w-32"><Progress value={a.progress} size="sm" tone={a.progress === 100 ? "success" : "default"} /></div>
                      <span className="text-[12px] font-medium text-muted-foreground numeric w-10">{a.progress}%</span>
                      <StatusBadge status={a.status} />
                      <Link href={`/quality/assessments/${a.id}/results`}>
                        <Button variant="ghost" size="icon-sm"><ArrowRight className="w-4 h-4" /></Button>
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* ===== Gaps Tab ===== */}
      {activeTab === 'gaps' && (
        <Card>
          <CardHeader><CardTitle icon={<AlertTriangle className="w-5 h-5" />}>الفجوات المسجلة</CardTitle><CardDescription>{gaps.length} فجوة — {gaps.filter((g: any) => g.status === 'OPEN').length} مفتوحة</CardDescription></CardHeader>
          <CardContent className="p-0">
            {gaps.length === 0 ? (
              <EmptyState icon={<CheckCircle2 />} title="لا توجد فجوات" description="جميع المؤشرات محققة." compact />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right">
                  <thead className="text-[12px] text-muted-foreground bg-surface-muted">
                    <tr><th className="px-4 py-3 font-medium">المؤشر</th><th className="px-4 py-3 font-medium">المجال</th><th className="px-4 py-3 font-medium">الأولوية</th><th className="px-4 py-3 font-medium">الحالة</th><th className="px-4 py-3 font-medium">التاريخ</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {gaps.map((g: any) => (
                      <tr key={g.id} className="hover:bg-surface-muted transition-smooth">
                        <td className="px-4 py-3.5"><p className="font-mono text-[12px] text-secondary">{g.indicator.code}</p><p className="text-[12px] text-muted-foreground truncate max-w-xs">{g.indicator.description}</p></td>
                        <td className="px-4 py-3.5 text-muted-foreground">{g.indicator.domain.name}</td>
                        <td className="px-4 py-3.5"><PriorityBadge priority={g.severity} /></td>
                        <td className="px-4 py-3.5"><StatusBadge status={g.status} /></td>
                        {/* FIX: formatRelativeTime handles strings */}
                        <td className="px-4 py-3.5 text-muted-foreground">{formatRelativeTime(g.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ===== Plans Tab ===== */}
      {activeTab === 'plans' && (
        <Card>
          <CardHeader><CardTitle icon={<FileText className="w-5 h-5" />}>خطط التحسين</CardTitle><CardDescription>{plans.length} خطة</CardDescription></CardHeader>
          <CardContent className="p-0">
            {plans.length === 0 ? (
              <EmptyState icon={<FileText />} title="لا توجد خطط تحسين" compact />
            ) : (
              <ul className="divide-y divide-border">
                {plans.map((p: any) => (
                  <li key={p.id} className="flex items-center gap-4 p-4 hover:bg-surface-muted transition-smooth">
                    <div className="w-10 h-10 rounded-lg bg-surface-muted flex items-center justify-center shrink-0"><FileText className="w-5 h-5 text-muted-foreground" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground-strong">{p.title}</p>
                      <p className="text-[12px] text-muted-foreground">{p.branch?.name ?? 'كامل المدرسة'}{p.gap && ` • مؤشر ${p.gap.indicator.code}`}</p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="w-32"><Progress value={p.progress} size="sm" tone={p.progress === 100 ? "success" : p.status === 'DELAYED' ? "danger" : "default"} /></div>
                      <span className="text-[12px] font-medium text-muted-foreground numeric w-10">{p.progress}%</span>
                      <StatusBadge status={p.status === 'DELAYED' ? 'DELAYED' : p.status === 'AT_RISK' ? 'AT_RISK' : 'ON_TRACK'} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* ===== Activity Tab ===== */}
      {activeTab === 'activity' && (
        <Card>
          <CardHeader><CardTitle icon={<ActivityIcon className="w-5 h-5" />}>سجل النشاطات</CardTitle></CardHeader>
          <CardContent className="p-0">
            {activities.length === 0 ? (
              <EmptyState icon={<ActivityIcon />} title="لا توجد نشاطات" compact />
            ) : (
              <ol className="relative space-y-4 p-4">
                <div className="absolute right-[26px] top-6 bottom-6 w-px bg-border" />
                {activities.map((a: any) => (
                  <li key={a.id} className="relative flex items-start gap-3">
                    <div className="relative z-10 w-9 h-9 rounded-full bg-surface border border-border flex items-center justify-center shrink-0"><ActivityIcon className="w-4 h-4 text-secondary" /></div>
                    <div className="flex-1 pt-1">
                      <p className="text-sm text-foreground-strong">{a.action} — {a.entityType}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {a.actor?.name && <span className="text-[12px] text-muted-foreground">{a.actor.name}</span>}
                        <span className="text-[12px] text-muted-foreground/40">•</span>
                        <span className="text-[12px] text-muted-foreground">{formatRelativeTime(a.createdAt)}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      )}

      {/* ===== Edit Modal ===== */}
      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="تعديل بيانات المدرسة" description="عدّل المعلومات الأساسية للمدرسة">
        <form onSubmit={handleEdit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-foreground-strong">اسم المدرسة <span className="text-danger">*</span></label>
            <Input name="name" required defaultValue={school.name} />
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-foreground-strong">الموقع <span className="text-danger">*</span></label>
            <Input name="location" required defaultValue={school.location} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-foreground-strong">الهاتف <span className="text-danger">*</span></label>
              <Input name="phone" required defaultValue={school.phone} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-foreground-strong">البريد <span className="text-danger">*</span></label>
              <Input name="email" required type="email" defaultValue={school.email} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-foreground-strong">الوصف</label>
            <Textarea name="description" defaultValue={school.description ?? ''} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>إلغاء</Button>
            <Button type="submit" variant="primary" icon={<Save className="w-4 h-4" />} loading={actionPending}>حفظ</Button>
          </div>
        </form>
      </Modal>

      {/* ===== Delete Modal ===== */}
      <Modal isOpen={deleteOpen} onClose={() => setDeleteOpen(false)} title="تأكيد الحذف" description="هذا الإجراء لا يمكن التراجع عنه.">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-danger/5 border border-danger/20 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground-strong">هل أنت متأكد من حذف {school.name}؟</p>
              <p className="text-[13px] text-muted-foreground mt-1">سيتم حذف المدرسة وجميع بياناتها نهائياً.</p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>إلغاء</Button>
            <Button variant="danger" onClick={handleDelete} loading={actionPending}>حذف نهائي</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function InfoField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground-strong">{value}</dd>
    </div>
  )
}