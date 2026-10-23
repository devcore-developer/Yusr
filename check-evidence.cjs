// check-evidence.cjs — قراءة فقط
const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()
async function main() {
  const assessmentId = process.argv[2]
  const total = await prisma.fixedEvidence.count()
  const byTool = await prisma.fixedEvidence.groupBy({ by: ["tool"], _count: { _all: true } })
  const verifiedRows = await prisma.evidenceResponse.count({ where: { assessmentId, isVerified: true } })
  const verifiedDistinct = (await prisma.evidenceResponse.findMany({
    where: { assessmentId, isVerified: true },
    select: { evidenceId: true },
    distinct: ["evidenceId"],
  })).length
  console.log(JSON.stringify({ total, byTool, verifiedRows, verifiedDistinct, remaining: total - verifiedDistinct }, null, 2))
  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })