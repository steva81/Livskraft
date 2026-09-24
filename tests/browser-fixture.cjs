// Add history only to a disposable account created by the browser QA flow.
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
async function main() {
  const email=process.argv[2]
  if (!/^quality-\d+@example\.invalid$/.test(email??'')) throw new Error('Disposable browser-test email required')
  const user=await prisma.user.findUnique({where:{email}})
  if (!user || user.name!=='Livskraft Test') throw new Error('Test account not found')
  if(process.argv[3]==='cleanup') {
    await prisma.user.delete({where:{id:user.id}})
    console.log('Disposable browser test account removed')
    return
  }
  const today=new Date();today.setHours(0,0,0,0)
  for(let i=1;i<=8;i++) {
    const date=new Date(today);date.setDate(date.getDate()-i)
    await prisma.dailyLog.upsert({where:{userId_date:{userId:user.id,date}},update:{},create:{userId:user.id,date,steps:1000,stepsRecorded:true,weight:114+i/10}})
  }
  const current=await prisma.weeklyPlan.findFirst({where:{userId:user.id,startDate:{lte:today},endDate:{gte:today}},include:{planDays:true}})
  if(!current) throw new Error('Open the current plan first')
  const startDate=new Date(current.startDate);startDate.setDate(startDate.getDate()-7)
  const endDate=new Date(current.endDate);endDate.setDate(endDate.getDate()-7)
  if(!await prisma.weeklyPlan.findFirst({where:{userId:user.id,startDate}})) await prisma.weeklyPlan.create({data:{userId:user.id,startDate,endDate,planDays:{create:current.planDays.map(d=>{const date=new Date(d.date);date.setDate(date.getDate()-7);return {date,dayOfWeek:d.dayOfWeek,workoutId:d.workoutId,meals:d.meals,activity:d.activity}})}}})
  console.log('Eight days of synthetic history added to the disposable test account')
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>prisma.$disconnect())
