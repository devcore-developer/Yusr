// ===== FILE: prisma/sync-school-management-indicators.ts =====
// ============================================================
// (المهمة 23) مزامنة مؤشري الإدارة المدرسية إلى قاعدة البيانات الحية
// أداة فحص الوثائق — 1-5-1-1 و1-5-1-2 (آخر بندي القسم بهذا الترتيب)
// ============================================================
// لماذا هذا السكربت؟ المصدر الموثوق لمؤشرات الأداة هو prisma/official-data.ts
// ويصل قاعدة البيانات عبر seed.ts — لكن seed.ts **مدمِّر بالكامل**
// (deleteMany لكل شيء: التقييمات والاستجابات والخطط والفجوات…)، فإعادة
// تشغيله لمجرد إضافة بندين تمسح بيانات التقييم الحقيقية. هذا السكربت
// يضيف البندين **دون إعادة تهيئة وبلا أي مساس بأي صف آخر**.
//
// الاستخدام:
//   npx tsx prisma/sync-school-management-indicators.ts
//
// الضمانات (مواصفة المهمة):
//   1) فحص-قبل-إدراج: يبحث عن كل كود أولاً — إن وُجد أُعيد استخدامه/حُدّث
//      ولا يُنشأ مكرر أبدًا (code فريد في المخطط أيضًا).
//   2) قابلية التكرار (Idempotent): تشغيله مرارًا بعد أول نجاح = «لا شيء
//      يتغير» — كل الكتابات مفهرسة بأكواد فريدة (indicator.code / evidence.code).
//   3) النطاق الضيق: يكتب حصرًا في: صفّي المؤشرين (إنشاء أو تعديل موضعي)،
//      صفوف شواهدهما بالأكواد المحددة في وحدة الإلحاق، وربط أداة فحص
//      الوثائق. لا حذف ولا إعادة تسمية ولا إعادة ترتيب لأي شيء آخر إطلاقًا.
//   4) لا اختراع بيانات: اسم المحور/الحالة المستهدفة إن لم تُحدد صراحةً
//      تُورَّث من آخر بند قائم في المجال نفسه (بترتيب رقمي للأكواد) ويُطبع
//      مصدر كل قيمة — ولا يُنشأ محور جديد أبدًا.
//   5) تحقق الترتيب: يطبع هل سيظهر المؤشران «أخيرتي تبويب فحص الوثائق»
//      مقارنة بأرقام فقرات شواهد الأداة القائمة (نفس ترتيب AssessmentEngine
//      بـ paragraphs[0].no).
//
// منطق القرار نقي ومُختبر آليًا — طبقة Prisma هنا رفيعة فقط.
// لا يعمل أي شيء تلقائيًا عند الاستيراد.
// ============================================================

import { pathToFileURL } from "url"
import {
  SCHOOL_MANAGEMENT_ADDENDUM,
  SCHOOL_MANAGEMENT_DOMAIN_NAME,
  SCHOOL_MANAGEMENT_AXIS_NAME,
  SCHOOL_MANAGEMENT_TARGET_STATUS,
  type OfficialDataIndicatorEntry,
} from "./official-data-school-management-addendum"
// وحدة نقية بلا أي استيرادات (آمنة في أي سياق) — مصدر واحد لقاعدة
// تطبيع العربية وأسماء المجال الرسمية بدل نسخها هنا
import { normalizeArabicName, SCHOOL_EVALUATION_DOMAINS } from "../src/features/quality-reports/services/weighted-score"

// اسم الأداة المستهدف حرفيًا — نفس النص في OFFICIAL_TOOL_ORDER (evidence-bank)
// وقائمة TOOLS (AssessmentEngine)
export const DOCUMENT_REVIEW_TOOL_NAME = "فحص الوثائق"

// ------------------------------------------------------------
// واجهة قاعدة البيانات — بنيوية ضيقة (كافية لعمليات هذا السكربت فقط)
// فصل مقصود عن @prisma/client: يُستورد فعليًا داخل main() حصريًا،
// فتبقى منطق المزامنة قابلًا للفحص النوعي والتشغيل الاختباري بلا قاعدة بيانات
// ------------------------------------------------------------
export interface SyncDb {
  domain: { findMany(args?: any): Promise<any[]> }
  axis: { findFirst(args: any): Promise<any | null> }
  indicator: {
    findUnique(args: any): Promise<any | null>
    findMany(args?: any): Promise<any[]>
    create(args: any): Promise<any>
    update(args: any): Promise<any>
  }
  assessmentTool: { findUnique(args: any): Promise<any | null> }
  fixedEvidence: {
    findUnique(args: any): Promise<any | null>
    findMany(args?: any): Promise<any[]>
    count(args: any): Promise<number>
    create(args: any): Promise<any>
    update(args: any): Promise<any>
  }
}

export type SyncLog = (line: string) => void

// ------------------------------------------------------------
// منطق نقي: مقارنة أكواد المؤشرات رقميًا (نفس عُرف extractNumericParts
// في بنك الشواهد: كل مقطع يُنقّى من غير الأرقام ثم يُقارن مقطعًا مقطعًا)
// ------------------------------------------------------------
export function compareNumericCodes(a: string, b: string): number {
  const segs = (s: string) =>
    s.split("-").map(p => {
      const n = parseInt(p.replace(/\D/g, ""), 10)
      return Number.isNaN(n) ? 0 : n
    })
  const x = segs(a)
  const y = segs(b)
  const len = Math.max(x.length, y.length)
  for (let i = 0; i < len; i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

/** المقطع الثاني من كود المؤشر (رقم المحور وفق بنية الأكواد 1-5-1-1) أو null */
export function axisSegmentOf(code: string): number | null {
  const parts = code.split("-").map(p => {
    const n = parseInt(p.replace(/\D/g, ""), 10)
    return Number.isNaN(n) ? null : n
  })
  return parts.length >= 2 && parts[1] !== null ? (parts[1] as number) : null
}

// ------------------------------------------------------------
// منطق نقي: إيجاد مجال الإدارة المدرسية في قائمة المجالات المخزنة —
// المطابقة الحرفية أولًا (بالإملاءين الرسميين من weighted-score)،
// ثم المطابقة المطبّعة (تشيل تشكيل/أقواس/همزات) — نفس قاعدة matchDomainConfig
// ------------------------------------------------------------
export interface DomainRowLike { id: string; name: string }

export function resolveSchoolManagementDomain(
  domains: DomainRowLike[],
  explicitName?: string,
): { domain: DomainRowLike; matchedBy: string } | null {
  const explicit = explicitName && explicitName.trim() ? explicitName.trim() : null
  const aliases: string[] = SCHOOL_EVALUATION_DOMAINS[0].names
  // أولوية صريحة ومحكمة: الاسم الصريح (حرفيًا ثم مطبّعًا) قبل كل الأسماء الرسمية
  // البديلة (حرفيًا ثم مطبّعًا) — تطابق حرفي أقوى من مطابق تطبيع في كل درجة
  if (explicit) {
    const exact = domains.find(d => d.name === explicit)
    if (exact) return { domain: exact, matchedBy: "exact-explicit" }
    const norm = normalizeArabicName(explicit)
    if (norm) {
      const fuzzy = domains.find(d => normalizeArabicName(d.name) === norm)
      if (fuzzy) return { domain: fuzzy, matchedBy: "normalized-explicit" }
    }
  }
  for (const alias of aliases) {
    const exact = domains.find(d => d.name === alias)
    if (exact) return { domain: exact, matchedBy: "exact-alias" }
  }
  for (const alias of aliases) {
    const norm = normalizeArabicName(alias)
    if (!norm) continue
    const fuzzy = domains.find(d => normalizeArabicName(d.name) === norm)
    if (fuzzy) return { domain: fuzzy, matchedBy: "normalized-alias" }
  }
  return null
}

/** آخر مؤشر قائم في المجال بترتيب الأكواد الرقمي — مرجع الوراثة الآمنة (بلا اختراع) */
export function pickLastIndicatorByCode(indicators: Array<{ code: string } & Record<string, any>>): (typeof indicators)[number] | null {
  if (indicators.length === 0) return null
  return indicators.reduce((last, cur) => (compareNumericCodes(cur.code, last.code) > 0 ? cur : last))
}

// ------------------------------------------------------------
// منطق نقي: قرار كتابة المؤشر الواحد (فحص-قبل-إدراج — المطلب 7)
// ------------------------------------------------------------
export interface IndicatorWriteDecision {
  action: "create" | "reuse" | "update"
  descriptionChanged: boolean
  notes: string[]
}

export function decideIndicatorWrite(
  existing: { description: string; tools?: Array<{ name: string }> } | null,
  input: OfficialDataIndicatorEntry,
  toolConnected: boolean,
): IndicatorWriteDecision {
  const notes: string[] = []
  if (!existing) return { action: "create", descriptionChanged: false, notes }
  let action: IndicatorWriteDecision["action"] = "reuse"
  let descriptionChanged = false
  if (existing.description !== input.text) {
    action = "update"
    descriptionChanged = true
    notes.push(`تحديث النص الحرفي: «${existing.description}» ← «${input.text}»`)
  }
  if (!toolConnected) {
    action = "update"
    notes.push(`ربط أداة «${DOCUMENT_REVIEW_TOOL_NAME}» (كانت غير مرتبطة)`)
  }
  return { action, descriptionChanged, notes }
}

// ------------------------------------------------------------
// منطق نقي: هل سيظهر المؤشران «أخيرتي تبويب فحص الوثائق»؟
// نفس ترتيب المحرك: مؤشرات الأداة تُرتب بـ paragraphs[0].no تصاعديًا —
// فالشرط المحافظ: أقل فقرة لشواهد المؤشرين الجديد > أعلى فقرة لكل
// شواهد الأداة القائمة (المطابقة بـ indicatorId لا بمعرف صف الشاهد)
// ------------------------------------------------------------
export interface ToolRowLike { indicatorId: string; paragraphNo: number | null }

export function willNewIndicatorsSortLast(
  toolRows: ToolRowLike[],
  newIndicatorIds: Set<string>,
): { willSortLast: boolean | null; newMin: number | null; existingMax: number | null } {
  const newRows = toolRows.filter(r => newIndicatorIds.has(r.indicatorId) && r.paragraphNo !== null && r.paragraphNo !== undefined)
  const existingRows = toolRows.filter(r => !newIndicatorIds.has(r.indicatorId) && r.paragraphNo !== null && r.paragraphNo !== undefined)
  if (newRows.length === 0) return { willSortLast: null, newMin: null, existingMax: existingRows.length ? Math.max(...existingRows.map(r => r.paragraphNo as number)) : null }
  const newMin = Math.min(...newRows.map(r => r.paragraphNo as number))
  const existingMax = existingRows.length ? Math.max(...existingRows.map(r => r.paragraphNo as number)) : null
  return { willSortLast: existingMax === null ? true : newMin > existingMax, newMin, existingMax }
}

// ------------------------------------------------------------
// منطق نقي: تحقق سلامة وحدة الإلحاق قبل أي كتابة
// ------------------------------------------------------------
export function validateAddendum(addendum: typeof SCHOOL_MANAGEMENT_ADDENDUM): string[] {
  const errors: string[] = []
  const codes = addendum.indicators.map(i => i.code)
  if (addendum.indicators.length === 0) errors.push("لا توجد مؤشرات في وحدة الإلحاق")
  for (const ind of addendum.indicators) {
    if (!ind.code.trim()) errors.push("كود مؤشر فارغ")
    if (!ind.text.trim()) errors.push(`نص المؤشر ${ind.code} فارغ`)
  }
  const dupCodes = codes.filter((c, i) => codes.indexOf(c) !== i)
  if (dupCodes.length) errors.push(`أكواد مكررة داخل وحدة الإلحاق: ${dupCodes.join(", ")}`)
  for (let i = 1; i < codes.length; i++) {
    if (compareNumericCodes(codes[i], codes[i - 1]) < 0) errors.push(`ترتيب المؤشرات غير تصاعدي عند ${codes[i]} — المواصفة تفرض الترتيب`)
  }
  const evIds = addendum.evidence.map(e => e.id)
  const dupIds = evIds.filter((c, i) => evIds.indexOf(c) !== i)
  if (dupIds.length) errors.push(`أكواد شواهد مكررة داخل وحدة الإلحاق: ${dupIds.join(", ")}`)
  for (const ev of addendum.evidence) {
    if (!codes.includes(ev.code)) errors.push(`الشاهد ${ev.id} يعود لكود ${ev.code} غير موجود في المؤشرين`)
    if (!ev.tool.trim()) errors.push(`الشاهد ${ev.id} بلا أداة — لا يُستنتاج تلقائيًا`)
  }
  return errors
}

// ------------------------------------------------------------
// المزامنة الفعلية — غير مدمرة، قابلة للتكرار، تقرير كامل
// ------------------------------------------------------------
export interface SyncResult {
  ok: boolean
  errors: string[]
  warnings: string[]
  domain: { matched: boolean; storedName?: string; matchedBy?: string }
  axis: { name?: string; source?: "explicit" | "addendum" | "derived" }
  indicators: Array<{ code: string; action: string; notes: string[] }>
  evidence: { created: number; reused: number; textUpdated: number }
  counters: Array<{ code: string; evidenceCount: number; paragraphCount: number; changed: boolean }>
  order: { willSortLast: boolean | null; newMin: number | null; existingMax: number | null; note: string }
}

export interface RunSyncOptions {
  db: SyncDb
  /** تجاوز اختياري لوحدة الإلحاق (للاختبارات الآلية — الافتراضي الوحدة المرفقة نفسها) */
  addendum?: typeof SCHOOL_MANAGEMENT_ADDENDUM
  explicitDomainName?: string
  explicitAxisName?: string
  log?: SyncLog
}

export async function runSync(opts: RunSyncOptions): Promise<SyncResult> {
  const { db } = opts
  const addendum = opts.addendum ?? SCHOOL_MANAGEMENT_ADDENDUM
  const log = opts.log ?? (() => {})
  const result: SyncResult = {
    ok: false,
    errors: [],
    warnings: [],
    domain: { matched: false },
    axis: {},
    indicators: [],
    evidence: { created: 0, reused: 0, textUpdated: 0 },
    counters: [],
    order: { willSortLast: null, newMin: null, existingMax: null, note: "" },
  }
  const fail = (msg: string) => { result.errors.push(msg); log(`✗ ${msg}`) }
  const warn = (msg: string) => { result.warnings.push(msg); log(`⚠ ${msg}`) }

  // 0) تحقق وحدة الإلحاق — قبل أي قراءة/كتابة
  const validationErrors = validateAddendum(addendum)
  if (validationErrors.length) {
    validationErrors.forEach(e => fail(`وحدة الإلحاق غير سليمة: ${e}`))
    return result
  }

  // 1) المجال — مطابقة بالإملاءين الرسميين + التطبيع (لا إنشاء مجال جديد أبدًا)
  const domains: any[] = await db.domain.findMany()
  const resolved = resolveSchoolManagementDomain(domains, opts.explicitDomainName)
  if (!resolved) {
    fail(`لم يُعثر على مجال الإدارة المدرسية في قاعدة البيانات (المخزن: ${domains.map(d => d.name).join(" / ") || "لا مجالات"}). عدّل SCHOOL_MANAGEMENT_DOMAIN_NAME في official-data-school-management-addendum.ts ليطابق اسم المجال المخزن حرفيًا.`)
    return result
  }
  result.domain = { matched: true, storedName: resolved.domain.name, matchedBy: resolved.matchedBy }
  log(`✓ المجال: «${resolved.domain.name}» (مطابقة: ${resolved.matchedBy})`)

  const domainIndicators: any[] = await db.indicator.findMany({ where: { domainId: resolved.domain.id } })
  const lastExisting = pickLastIndicatorByCode(domainIndicators)

  // تنبيه حدود المحور: إن بدأ المقطع الثاني للجديد رقم محور أكبر من كل القائم بالمجال
  if (lastExisting) {
    const maxAxisSeg = Math.max(...domainIndicators.map(i => axisSegmentOf(i.code) ?? 0))
    const newSegs = addendum.indicators.map(i => axisSegmentOf(i.code) ?? 0)
    if (newSegs.some(s => s > maxAxisSeg)) {
      warn(`المقطع الثاني لأكواد المؤشرين (${newSegs.join(", ")}) أكبر من كل المحاور القائمة في المجال (الحد الأقصى ${maxAxisSeg}) — إن كانا محورًا جديدًا فحدد explicitAxisName باسم محوره الرسمي، وإلا ستورث محور آخر بند قائم (${(lastExisting as any).code}).`)
    }
  }

  // 2) المحور — صريح ثم وحدة الإلحاق ثم الوراثة من آخر بند (لا إنشاء محور جديد)
  let axisRow: any = null
  const wantedAxis = (opts.explicitAxisName ?? "").trim() || SCHOOL_MANAGEMENT_AXIS_NAME.trim()
  if (wantedAxis) {
    axisRow = await db.axis.findFirst({ where: { domainId: resolved.domain.id, name: wantedAxis } })
    if (!axisRow) {
      const axisNames = Array.from(new Set(domainIndicators.map(i => i.axis?.name).filter(Boolean)))
      fail(`المحور المحدد «${wantedAxis}» غير موجود في المجال «${resolved.domain.name}» (المحاور القائمة: ${axisNames.join(" / ") || "لا شيء"}). لا يُنشأ محور جديد تلقائيًا.`)
      return result
    }
    result.axis = { name: axisRow.name, source: opts.explicitAxisName?.trim() ? "explicit" : "addendum" }
  } else if (lastExisting && (lastExisting as any).axisId) {
    axisRow = await db.axis.findFirst({ where: { domainId: resolved.domain.id, id: (lastExisting as any).axisId } })
    if (!axisRow) { fail("تعذر إيجاد محور آخر بند قائم للوراثة."); return result }
    result.axis = { name: axisRow.name, source: "derived" }
  } else {
    fail("لا مؤشرات قائمة في المجال للوراثة من محورها — حدد explicitAxisName صراحةً.")
    return result
  }
  log(`✓ المحور: «${result.axis.name}» (المصدر: ${result.axis.source === "derived" ? `وراثة من آخر بند قائم ${(lastExisting as any).code}` : result.axis.source})`)

  // 3) الحالة المستهدفة — صريحة ثم وراثة من آخر بند (لا اختراع)
  const wantedTarget = SCHOOL_MANAGEMENT_TARGET_STATUS.trim()
  const inheritedTarget = wantedTarget || ((lastExisting as any)?.targetStatus ?? "")
  if (!wantedTarget && !inheritedTarget) {
    fail("لا حالة مستهدفة صريحة ولا بند قائم تورَّث منها — حدد SCHOOL_MANAGEMENT_TARGET_STATUS في وحدة الإلحاق.")
    return result
  }
  if (!wantedTarget && lastExisting) log(`✓ الحالة المستهدفة: وراثة من ${(lastExisting as any).code} («${inheritedTarget}»)`)

  // 4) سجل أداة فحص الوثائق (للربط) — إن لم توجد فالمؤشران يُنشآن بلا ربط مع تنبيه
  const toolRecord = await db.assessmentTool.findUnique({ where: { name: DOCUMENT_REVIEW_TOOL_NAME } })
  if (!toolRecord) warn(`لا صف أداة باسم «${DOCUMENT_REVIEW_TOOL_NAME}» في AssessmentTool — سيُنشأ المؤشران بلا ربط أدوات (الأداة في الشواهد عمود نصي فلا يتأثر ظهورها هناك).`)

  // 5) المؤشران — فحص-قبل-إدراج بالكود الفريد (المطلب 7)
  const indicatorIdByCode = new Map<string, string>()
  for (const input of addendum.indicators) {
    const existing = await db.indicator.findUnique({ where: { code: input.code }, include: { tools: true, domain: true, axis: true } })
    const decision = decideIndicatorWrite(existing, input, Boolean(existing && toolRecord && (existing.tools ?? []).some((t: any) => t.id === toolRecord.id)))

    if (decision.action === "create") {
      const created = await db.indicator.create({
        data: {
          domainId: resolved.domain.id,
          axisId: axisRow.id,
          code: input.code,
          description: input.text,
          targetStatus: inheritedTarget,
          coverage: input.coverage || "مغطى",
          tools: toolRecord ? { connect: [{ id: toolRecord.id }] } : undefined,
        },
      })
      indicatorIdByCode.set(input.code, created.id)
      result.indicators.push({ code: input.code, action: "created", notes: decision.notes })
      log(`✓ مؤشر ${input.code}: أُنشئ (المحور «${axisRow.name}»، الحالة المستهدفة «${inheritedTarget}»، التغطية «${input.coverage || "مغطى"}»${toolRecord ? `، أداة «${DOCUMENT_REVIEW_TOOL_NAME}»` : ""})`)
    } else {
      // reuse/update — لا يُنقل مجالًا أو محورًا أبدًا (المطلب 8: أدنى تعديل ضروري)
      const notes = [...decision.notes]
      if ((existing as any).domainId !== resolved.domain.id) {
        warn(`مؤشر ${input.code} قائم أصلاً في مجال آخر («${(existing as any).domain?.name ?? (existing as any).domainId}») — أُعيد استخدامه كما هو ولا يُنقل (لا يُعدل سوى الضروري).`)
      }
      const data: Record<string, any> = {}
      if (decision.descriptionChanged) data.description = input.text
      if (toolRecord && !(existing.tools ?? []).some((t: any) => t.id === toolRecord.id)) data.tools = { connect: [{ id: toolRecord.id }] }
      const updated = Object.keys(data).length > 0
      const row = updated ? await db.indicator.update({ where: { id: (existing as any).id }, data }) : existing
      indicatorIdByCode.set(input.code, (row as any).id)
      result.indicators.push({ code: input.code, action: updated ? "updated" : "reused", notes })
      log(`✓ مؤشر ${input.code}: ${updated ? "أُعيد استخدامه وحُدّث" : "أُعيد استخدامه كما هو (قائم مسبقًا — لا تكرار)"}${notes.length ? ` — ${notes.join("؛ ")}` : ""}`)
    }
  }

  // 6) الشواهد — بالأكواد الفريدة من وحدة الإلحاق فقط (فارغة افتراضيًا بلا أي اختراع)
  for (const ev of addendum.evidence) {
    const indicatorId = indicatorIdByCode.get(ev.code)
    if (!indicatorId) { fail(`الشاهد ${ev.id} يعود لكود غير مُزامن (${ev.code}) — تخطي`); continue }
    const existingEv = await db.fixedEvidence.findUnique({ where: { code: ev.id } })
    if (existingEv) {
      if ((existingEv as any).indicatorId !== indicatorId) {
        fail(`تعارض: الشاهد ${ev.id} قائم ويعود لمؤشر آخر (${(existingEv as any).indicatorCode ?? (existingEv as any).indicatorId}) — لا يُنقل ولا يُلمس. صحّح كود الشاهد في وحدة الإلحاق.`)
        continue
      }
      if ((existingEv as any).text !== ev.text) {
        await db.fixedEvidence.update({ where: { id: (existingEv as any).id }, data: { text: ev.text } })
        result.evidence.textUpdated++
        log(`✓ شاهد ${ev.id}: حُدّث نصه الحرفي`)
      } else {
        result.evidence.reused++
      }
      continue
    }
    await db.fixedEvidence.create({
      data: {
        code: ev.id,
        text: ev.text,
        tool: ev.tool,
        indicatorCode: ev.code,
        paragraphNo: ev.paragraphNo ?? null,
        paragraphText: ev.paragraph ?? null,
        indicatorId,
      },
    })
    result.evidence.created++
  }
  log(`✓ الشواهد: أُنشئ ${result.evidence.created} / قائم مُعاد ${result.evidence.reused} / حُدّث نصه ${result.evidence.textUpdated}`)

  // 7) عدادات المؤشرين من الحقيقة الفعلية (صفوف الشواهد) — مثل ما تعرضه الشاشات
  // (Array.from حماية TS2802 مع target ES5 — نفس النمط الموثق في Task 21-b)
  for (const [code, indicatorId] of Array.from(indicatorIdByCode)) {
    const rows: any[] = await db.fixedEvidence.findMany({ where: { indicatorId }, select: { paragraphNo: true } })
    const distinctParas = new Set(rows.map(r => r.paragraphNo).filter(n => n !== null && n !== undefined))
    const evidenceCount = rows.length
    const paragraphCount = distinctParas.size
    const current = await db.indicator.findUnique({ where: { id: indicatorId }, select: { evidenceCount: true, paragraphCount: true } })
    const changed = Boolean(current && ((current as any).evidenceCount !== evidenceCount || (current as any).paragraphCount !== paragraphCount))
    if (changed) {
      await db.indicator.update({ where: { id: indicatorId }, data: { evidenceCount, paragraphCount } })
      log(`✓ عدادات ${code}: evidenceCount=${evidenceCount}، paragraphCount=${paragraphCount} (حُدّثت من صفوف الشواهد الفعلية)`)
    }
    result.counters.push({ code, evidenceCount, paragraphCount, changed })
  }

  // 8) تحقق الترتيب داخل تبويب فحص الوثائق (نفس ترتيب AssessmentEngine)
  const newIds = new Set(Array.from(indicatorIdByCode.values()))
  const toolRows: any[] = await db.fixedEvidence.findMany({ where: { tool: DOCUMENT_REVIEW_TOOL_NAME }, select: { indicatorId: true, paragraphNo: true } })
  const orderCheck = willNewIndicatorsSortLast(toolRows, newIds)
  result.order = { ...orderCheck, note: "" }
  if (orderCheck.willSortLast === null) {
    result.order.note = "لا شواهد فحص وثائق للمؤشرين بعد — لن يظهرا داخل تبويب الأداة حتى تُضاف شواهدهما الرسمية (سيظهران في قوائم المؤشرات الأخرى: الاستبانات/الخطط/النسخ الاحتياطي)."
    warn(result.order.note)
  } else if (orderCheck.willSortLast) {
    result.order.note = `سيظهر المؤشران أخيرتي تبويب فحص الوثائق (أقل فقرة للجديد ${orderCheck.newMin} > أعلى فقرة قائمة ${orderCheck.existingMax ?? "—"}).`
    log(`✓ ${result.order.note}`)
  } else {
    result.order.note = `تنبيه ترتيب: أقل فقرة للجديد (${orderCheck.newMin}) ليست بعد أعلى فقرة قائمة (${orderCheck.existingMax}) — قد لا يظهرا أخيرتي التبويب. راجع أرقام paragraphNo في وثيقتك الرسمية.`
    warn(result.order.note)
  }

  result.ok = result.errors.length === 0
  return result
}

// ------------------------------------------------------------
// نقطة الدخول — لا تعمل عند الاستيراد (اختبارات آمنة)
// ------------------------------------------------------------
function isDirectRun(): boolean {
  const entry = process.argv[1] ?? ""
  if (!entry) return false
  try {
    if (import.meta.url === pathToFileURL(entry).href) return true
  } catch { /* تجاهل — نكمل بالفحص البديل */ }
  return entry.replace(/\\/g, "/").endsWith("sync-school-management-indicators.ts")
}

async function main() {
  let PrismaClientCtor: any
  try {
    const mod: any = await import("@prisma/client")
    PrismaClientCtor = mod.PrismaClient
  } catch {
    console.error("✗ @prisma/client غير متاح — شغّل من جذر المشروع بعد npm install و npx prisma generate")
    process.exit(1)
  }
  const db = new PrismaClientCtor()
  try {
    console.log("— مزامنة مؤشري الإدارة المدرسية (فحص الوثائق): 1-5-1-1 و1-5-1-2 —")
    const result = await runSync({ db, explicitDomainName: SCHOOL_MANAGEMENT_DOMAIN_NAME, log: l => console.log(l) })
    console.log("— ملخص —")
    console.log(JSON.stringify(result, null, 2))
    if (!result.ok) {
      console.error("✗ اكتمل بوجود أخطاء — راجع الأسطر أعلاه. لم يُمس أي صف خارج النطاق الضيق.")
      process.exit(1)
    }
    console.log("✓ تمت المزامنة بنجاح (غير مدمرة وقابلة لإعادة التشغيل)")
  } finally {
    await db.$disconnect()
  }
}

if (isDirectRun()) {
  main().catch(e => {
    console.error("✗ فشل غير متوقع:", e?.message ?? e)
    process.exit(1)
  })
}