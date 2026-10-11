import { PrismaClient, UserRole, UserStatus, SchoolStatus, SubscriptionStatus, AssessmentStatus, GapSeverity, GapStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { DATA } from './official-data'

const prisma = new PrismaClient()

async function main() {
  console.log('🧹 Cleaning up old data...')
  await prisma.activity.deleteMany()
  await prisma.improvementFollowUp.deleteMany()
  await prisma.improvementAction.deleteMany()
  await prisma.improvementPlan.deleteMany()
  await prisma.evidence.deleteMany()
  await prisma.gap.deleteMany()
  await prisma.evidenceResponse.deleteMany()
  await prisma.assessmentResponse.deleteMany()
  await prisma.assessment.deleteMany()
  await prisma.fixedEvidence.deleteMany()
  await prisma.indicator.deleteMany()
  await prisma.assessmentTool.deleteMany()
  await prisma.axis.deleteMany()
  await prisma.domain.deleteMany()
  await prisma.subscription.deleteMany()
  await prisma.branch.deleteMany()
  await prisma.user.deleteMany()
  await prisma.school.deleteMany()
  await prisma.contactMessage.deleteMany()
  console.log('✅ Old data cleaned.')

  const password = await bcrypt.hash('123456', 10)

  const superAdmin = await prisma.user.create({
    data: { name: 'سلمان الشهري', email: 'admin@yusr.com', password, role: UserRole.SUPER_ADMIN, status: UserStatus.ACTIVE },
  })

  const school1 = await prisma.school.create({
    data: {
      name: 'مدارس المستقبل الأهلية',
      description: 'مدارس رائدة في التعليم الحديث',
      location: 'الرياض - حي النخيل',
      phone: '+966501234567',
      officialEmail: 'info@future.sch',
      status: SchoolStatus.ACTIVE,
      users: { create: { name: 'محمد الزهراني', email: 'manager@future.sch', password, role: UserRole.SCHOOL_MANAGER, status: UserStatus.ACTIVE } },
      subscriptions: { create: { plan: 'Enterprise', status: SubscriptionStatus.ACTIVE, startDate: new Date('2024-01-01'), endDate: new Date('2025-01-01') } },
    },
  })

  const branch1 = await prisma.branch.create({
    data: { schoolId: school1.id, name: 'الفرع الرئيسي (حي النخيل)', location: 'الرياض - حي النخيل', phone: '+966501111111', status: SchoolStatus.ACTIVE },
  })

  const branchManager = await prisma.user.create({
    data: { name: 'أحمد العتيبي', email: 'branch@future.sch', password, role: UserRole.BRANCH_MANAGER, status: UserStatus.ACTIVE, schoolId: school1.id, branchId: branch1.id },
  })

  const assessor = await prisma.user.create({
    data: { name: 'نورة السبيعي', email: 'assessor@future.sch', password, role: UserRole.QUALITY_ASSESSOR, status: UserStatus.ACTIVE, schoolId: school1.id, branchId: branch1.id },
  })

  const school2 = await prisma.school.create({
    data: {
      name: 'مدارس النخبة الدولية',
      description: 'تعليم دولي بمعايير عالية',
      location: 'جدة - حي الشاطئ',
      phone: '+966502345678',
      officialEmail: 'admin@elite.sch',
      status: SchoolStatus.ACTIVE,
      subscriptions: { create: { plan: 'Pro', status: SubscriptionStatus.EXPIRING_SOON, startDate: new Date('2023-09-01'), endDate: new Date(Date.now() + 5 * 86400000) } },
    },
  })

  await prisma.branch.create({
    data: { schoolId: school2.id, name: 'فرع حي الشاطئ', location: 'جدة - حي الشاطئ', phone: '+966502222222', status: SchoolStatus.ACTIVE },
  })

  // 1. Create Domains
  const domains = await Promise.all(DATA.domains.map(d => prisma.domain.create({ data: { name: d, description: d } })))

  // 2. Create Axes
  const axesSet = new Set(DATA.indicators.map(i => `${i.domain}|${i.axis}`))
  const axes = await Promise.all(Array.from(axesSet).map(a => {
    const [domainName, axisName] = a.split('|')
    return prisma.axis.create({ data: { name: axisName, domainId: domains.find(d => d.name === domainName)!.id } })
  }))

  // 3. Create Tools
  const tools = await Promise.all(DATA.tools.map(t => prisma.assessmentTool.create({ data: { name: t } })))

  // 4. Create Indicators with Tools
  const indicators = await Promise.all(DATA.indicators.map(async i => {
    const domain = domains.find(d => d.name === i.domain)!
    const axis = axes.find(a => a.name === i.axis)!
    const indicatorTools = i.tools.split('؛').map(t => t.trim()).filter(t => t !== 'لا توجد أداة مرتبطة')
    const connectedTools = tools.filter(t => indicatorTools.includes(t.name))
    
    return prisma.indicator.create({
      data: {
        domainId: domain.id,
        axisId: axis.id,
        code: i.code,
        description: i.text,
        targetStatus: i.target,
        coverage: i.coverage,
        evidenceCount: i.evidenceCount,
        paragraphCount: i.paragraphs,
        tools: { connect: connectedTools.map(t => ({ id: t.id })) }
      }
    })
  }))

  // 5. Create Fixed Evidence (597 items)
  console.log(`📊 Seeding ${DATA.evidence.length} evidence items...`)
  for (const ev of DATA.evidence) {
    const indicator = indicators.find(i => i.code === ev.code)
    if (indicator) {
      await prisma.fixedEvidence.create({
        data: {
          code: ev.id,
          text: ev.text,
          tool: ev.tool,
          indicatorCode: ev.code,
          paragraphNo: ev.paragraphNo || null,
          paragraphText: ev.paragraph || null,
          indicatorId: indicator.id
        }
      })
    }
  }
  console.log('✅ Evidence seeded successfully.')

  // 6. Create Assessment
  const assessment = await prisma.assessment.create({
    data: {
      schoolId: school1.id,
      branchId: branch1.id,
      assessorId: assessor.id,
      status: AssessmentStatus.IN_PROGRESS,
      startedAt: new Date(),
    },
  })

  await prisma.activity.createMany({
    data: [
      { actorId: superAdmin.id, schoolId: school1.id, action: 'CREATE', entityType: 'SCHOOL', entityId: school1.id, metadata: { description: 'تم إنشاء مدارس المستقبل الأهلية' } },
      { actorId: branchManager.id, schoolId: school1.id, branchId: branch1.id, action: 'CREATE', entityType: 'BRANCH', entityId: branch1.id, metadata: { description: 'تم إنشاء الفرع الرئيسي' } },
      { actorId: assessor.id, schoolId: school1.id, branchId: branch1.id, action: 'CREATE', entityType: 'ASSESSMENT', entityId: assessment.id, metadata: { description: 'تم بدء تقييم جديد' } },
    ],
  })

  console.log('✅ Database seeded successfully with OFFICIAL quality data and 597 Evidence items!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })