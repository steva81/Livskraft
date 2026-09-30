import "server-only"
import prisma from "./prisma"
import { readPreferences } from "./preferences"

export async function readAICoachPreference(userId:string):Promise<boolean|null> {
  const user = await prisma.user.findUnique({where:{id:userId},select:{preferences:true}})
  return readPreferences(user?.preferences ?? null).aiCoachEnabled ?? null
}

export async function saveAICoachPreference(userId:string,enabled:boolean):Promise<void> {
  await prisma.$transaction(async tx=>{
    const user = await tx.user.findUniqueOrThrow({where:{id:userId},select:{preferences:true}})
    const preferences = {...readPreferences(user.preferences),aiCoachEnabled:enabled}
    await tx.user.update({where:{id:userId},data:{preferences:JSON.stringify(preferences)}})
  })
}
