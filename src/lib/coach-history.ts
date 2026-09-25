import prisma from "./prisma"

export async function readCoachHistory(userId: string) {
  const rows = await prisma.coachExchange.findMany({
    where: { userId }, orderBy: { id: "desc" }, take: 50,
    select: { id: true, question: true, reply: true },
  })
  return rows.reverse().flatMap(row => [
    { id: `${row.id}-user`, role: "user" as const, text: row.question },
    { id: `${row.id}-coach`, role: "coach" as const, text: row.reply },
  ])
}

export async function saveCoachExchange(userId: string, question: string, reply: string) {
  await prisma.$transaction(async tx => {
    await tx.coachExchange.create({ data: { userId, question, reply } })
    const expired = await tx.coachExchange.findMany({
      where: { userId }, orderBy: { id: "desc" }, skip: 50, select: { id: true },
    })
    if (expired.length) await tx.coachExchange.deleteMany({ where: { userId, id: { in: expired.map(row => row.id) } } })
  })
}
