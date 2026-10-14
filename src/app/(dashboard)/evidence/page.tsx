import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Input } from "@/components/ui/Input"
import { Database, Search } from "lucide-react"
import { Button } from "@/components/ui/Button"

// Official tool order as per the HTML reference file
const OFFICIAL_TOOL_ORDER = [
  "البيئة المدرسية",
  "فحص الوثائق",
  "مقابلة المدير",
  "مقابلة المعلمين",
  "مقابلة المتعلمين",
  "مقابلة الموجه الطلابي",
  "الملاحظة الصفية"
]

function getToolOrder(tool: string): number {
  const idx = OFFICIAL_TOOL_ORDER.indexOf(tool)
  return idx === -1 ? 999 : idx
}

function extractNumericParts(code: string): number[] {
  const parts = code.split('-')
  const nums: number[] = []
  for (const p of parts) {
    const n = parseInt(p.replace(/\D/g, ''), 10)
    if (!isNaN(n)) nums.push(n)
  }
  return nums.length ? nums : [0]
}

function compareEvidenceCodes(a: string, b: string): number {
  const numsA = extractNumericParts(a)
  const numsB = extractNumericParts(b)
  const maxLen = Math.max(numsA.length, numsB.length)
  for (let i = 0; i < maxLen; i++) {
    const va = numsA[i] ?? 0
    const vb = numsB[i] ?? 0
    if (va !== vb) return va - vb
  }
  return 0
}

export default async function EvidenceBankPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const q = typeof searchParams.q === 'string' ? searchParams.q : undefined
  const tool = typeof searchParams.tool === 'string' ? searchParams.tool : undefined

  const where: any = {}
  if (q) {
    where.OR = [
      { text: { contains: q, mode: 'insensitive' } },
      { code: { contains: q, mode: 'insensitive' } },
    ]
  }
  if (tool) where.tool = tool

  const evidence = await prisma.fixedEvidence.findMany({
    where,
    include: { indicator: { include: { domain: true, axis: true } } },
    orderBy: { code: 'asc' }
  })

  // Apply official ordering: by tool order, then by numeric parts of code
  evidence.sort((a, b) => {
    const toolA = getToolOrder(a.tool)
    const toolB = getToolOrder(b.tool)
    if (toolA !== toolB) return toolA - toolB
    return compareEvidenceCodes(a.code, b.code)
  })

  const tools = await prisma.fixedEvidence.findMany({
    select: { tool: true },
    distinct: ['tool']
  })

  // Sort tools by official order too
  tools.sort((a, b) => getToolOrder(a.tool) - getToolOrder(b.tool))

  return (
    <div className="space-y-6">
      <PageHeader
        title="بنك الشواهد"
        description="جميع الشواهد الرسمية المرجعية للإطلاع عليها وربطها بالتقييمات."
        breadcrumbs={[{ label: 'الرئيسية', href: '/' }, { label: 'بنك الشواهد' }]}
      />

      <form method="GET" className="flex flex-wrap items-center gap-3 p-4 bg-surface border border-border rounded-lg min-w-0">
        <div className="relative flex-1 min-w-[200px] min-w-0">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input name="q" defaultValue={q} placeholder="ابحث في نص الشاهد أو الكود..." className="pr-10 w-full" />
        </div>
        <select 
          name="tool" 
          defaultValue={tool || ""}
          className="h-10 px-3 rounded-md border border-border bg-surface text-sm w-full sm:w-auto sm:min-w-[180px]"
        >
          <option value="">كل الأدوات</option>
          {tools.map((t: any) => (
            <option key={t.tool} value={t.tool}>{t.tool}</option>
          ))}
        </select>
        <Button type="submit" variant="primary" size="md" icon={<Search className="w-4 h-4" />}>تصفية</Button>
      </form>

      <p className="text-[13px] text-muted-foreground min-w-0">
        <span className="numeric font-medium text-foreground-strong">{evidence.length}</span> شاهد مطابق
      </p>

      {/* Desktop Table Layout */}
      <Card className="overflow-hidden hidden md:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm text-right min-w-[800px]">
              <thead className="text-[12px] text-muted-foreground bg-surface-muted uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">الكود</th>
                  <th className="px-4 py-3 font-medium">نص الشاهد</th>
                  <th className="px-4 py-3 font-medium">المؤشر</th>
                  <th className="px-4 py-3 font-medium">المجال</th>
                  <th className="px-4 py-3 font-medium">الأداة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {evidence.map((ev: any) => (
                  <tr key={ev.id} className="hover:bg-surface-muted/50 transition-smooth">
                    <td className="px-4 py-3 font-mono text-secondary text-[12px] whitespace-nowrap">{ev.code}</td>
                    <td className="px-4 py-3 text-foreground-strong break-words min-w-[200px]">{ev.text}</td>
                    <td className="px-4 py-3 text-muted-foreground text-[13px]">{ev.indicator?.code}</td>
                    <td className="px-4 py-3 text-muted-foreground text-[13px]">{ev.indicator?.domain?.name}</td>
                    <td className="px-4 py-3"><Badge variant="neutral">{ev.tool}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Mobile Card Layout */}
      <div className="grid grid-cols-1 gap-4 md:hidden min-w-0">
        {evidence.map((ev: any) => (
          <Card key={ev.id} className="p-4 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-secondary text-[12px] break-all">{ev.code}</span>
              <Badge variant="neutral">{ev.tool}</Badge>
            </div>
            <p className="text-sm text-foreground-strong mb-3 break-words">{ev.text}</p>
            <div className="border-t pt-2 space-y-1 text-xs text-muted-foreground">
              <p><span className="font-medium">المؤشر:</span> {ev.indicator?.code}</p>
              <p><span className="font-medium">المجال:</span> {ev.indicator?.domain?.name}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}