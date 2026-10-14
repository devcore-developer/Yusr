import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const newEmail = 'Yusrrbm@gmail.com'
  
  // 1. التحقق من أن البريد الجديد غير مستخدم من قبل حساب آخر
  const existing = await prisma.user.findUnique({ where: { email: newEmail } })
  if (existing && existing.role !== 'SUPER_ADMIN') {
    console.error('الخطأ: البريد الإلكتروني الجديد مستخدم بالفعل من قبل حساب آخر.')
    return
  }

  // 2. البحث عن حساب السوبر أدمن الحالي
  const superAdmin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } })
  if (!superAdmin) {
    console.error('الخطأ: لا يوجد حساب سوبر أدمن في قاعدة البيانات.')
    return
  }

  // حفظ البريد القديم لتسجيله في النشاط
  const oldEmail = superAdmin.email

  // 3. تحديث البريد الإلكتروني مع الحفاظ على الـ ID والصلاحيات
  await prisma.user.update({
    where: { id: superAdmin.id },
    data: { email: newEmail }
  })

  // 4. تسجيل عملية التغيير في سجل النشاطات (Audit Log)
  await prisma.activity.create({
    data: {
      actorId: superAdmin.id,
      action: "SUPER_ADMIN_EMAIL_UPDATE",
      entityType: "USER",
      entityId: superAdmin.id,
      metadata: { 
        oldEmail: oldEmail, 
        newEmail: newEmail,
        note: "Super Admin email updated via script."
      }
    }
  })

  console.log(`تم تحديث بريد السوبر أدمن بنجاح إلى: ${newEmail} (مع الحفاظ على ID: ${superAdmin.id})`)
  console.log('تم تسجيل العملية في سجل النشاطات.')
}

main().catch(console.error).finally(() => prisma.$disconnect())