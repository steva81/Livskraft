import prisma from "./prisma"

// Internal service. Callers must derive userId from an authenticated session.
// Future providers require consent, source IDs, deduplication and timezone handling.
export async function recordManualSteps(userId: string, date: Date, steps: number, increment = false) {
  if (!Number.isInteger(steps) || steps<0 || steps>100000) throw new Error("Kontrollera stegantalet")
  return prisma.dailyLog.upsert({where:{userId_date:{userId,date}},
    update:{steps:increment ? {increment:steps}:steps,stepsRecorded:true},
    create:{userId,date,steps,stepsRecorded:true},
  })
}
