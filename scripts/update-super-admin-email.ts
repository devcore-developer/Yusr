import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const newEmail = 'Yusrrbm@gmail.com'
  
  // Check if email is already in use
  const existing = await prisma.user.findUnique({ where: { email: newEmail } })
  if (existing && existing.role !== 'SUPER_ADMIN') {
    console.error('Email is already assigned to another account.')
    return
  }

  // Find the current Super Admin
  const superAdmin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } })
  if (!superAdmin) {
    console.error('No Super Admin account found.')
    return
  }

  // Store old email for logging
  const oldEmail = superAdmin.email

  // Update email
  await prisma.user.update({
    where: { id: superAdmin.id },
    data: { email: newEmail }
  })

  // Log activity
  await prisma.activity.create({
    data: {
      actorId: superAdmin.id,
      action: "SUPER_ADMIN_EMAIL_UPDATE",
      entityType: "USER",
      entityId: superAdmin.id,
      metadata: { oldEmail: oldEmail, newEmail: newEmail }
    }
  })

  console.log(`Super Admin email updated to ${newEmail} for user ID: ${superAdmin.id}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())