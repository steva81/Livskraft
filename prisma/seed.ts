import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  await prisma.planDay.deleteMany()
  await prisma.weeklyPlan.deleteMany()
  await prisma.workoutLog.deleteMany()
  await prisma.workout.deleteMany()
  await prisma.dailyLog.deleteMany()
  await prisma.mealPlan.deleteMany()
  await prisma.user.deleteMany()
  await prisma.recipe.deleteMany()

  // 1. Create a demo user with a password for testing
  const user = await prisma.user.create({
    data: {
      name: 'Anna (Demo)',
      email: 'anna@demo.com',
      password: 'password123', // Demo purpose
      mode: 'simple',
      currentWeight: 75.5,
      targetWeight: 68.0,
      timeframeWeeks: 12,
      height: 168,
      waist: 85,
      activityLevel: 'moderate',
      stepGoal: 8000,
      dietRestrictions: JSON.stringify(['lactose-free']),
      dislikedFoods: JSON.stringify(['svamp', 'lever']),
      lifestyle: JSON.stringify(['office-worker', 'family']),
    },
  })

  // 2. Create some recipes
  const recipe1 = await prisma.recipe.create({
    data: {
      title: 'Snabb Kycklingwok med Nudlar',
      description: 'Enkel och god wok som passar perfekt efter jobbet.',
      prepTime: 20,
      ingredients: JSON.stringify(['200g kycklingbröst', '1 port äggnudlar', '100g broccoli', '2 msk soja', '1 vitlöksklyfta']),
      instructions: JSON.stringify(['Strimla kycklingen och stek.', 'Koka nudlarna.', 'Dela broccolin.', 'Blanda ner nudlar och soja.']),
      nutrition: JSON.stringify({ calories: 450, protein: 45, carbs: 40, fat: 12 }),
      tags: JSON.stringify(['dinner', 'quick', 'lactose-free']),
    }
  })

  const recipe2 = await prisma.recipe.create({
    data: {
      title: 'Krämig Havregröt med Bär',
      description: 'Mättande frukost som ger bra energi.',
      prepTime: 10,
      ingredients: JSON.stringify(['1 dl havregryn', '2 dl vatten', '1 dl frysta hallon', '1 msk linfrön', '1 dl laktosfri mjölk']),
      instructions: JSON.stringify(['Blanda havregryn och vatten.', 'Koka upp.', 'Rör ner bär.', 'Servera.']),
      nutrition: JSON.stringify({ calories: 320, protein: 12, carbs: 45, fat: 8 }),
      tags: JSON.stringify(['breakfast', 'vegetarian', 'lactose-free']),
    }
  })

  // 3. Create workouts
  const workoutHome = await prisma.workout.create({
    data: {
      title: 'Hemmaträning: Helkropp',
      type: 'home',
      level: 'beginner',
      duration: 20,
      exercises: JSON.stringify([
        { name: 'Armhävningar', sets: 3, reps: '10-15' },
        { name: 'Knäböj', sets: 3, reps: '15-20' },
        { name: 'Plankan', sets: 3, reps: '45 sek' }
      ])
    }
  })

  const workoutGym = await prisma.workout.create({
    data: {
      title: 'Gym: Underkropp',
      type: 'gym',
      level: 'intermediate',
      duration: 45,
      exercises: JSON.stringify([
        { name: 'Knäböj med skivstång', sets: 4, reps: '8-10' },
        { name: 'Benpress', sets: 3, reps: '10-12' },
        { name: 'Vadpress', sets: 3, reps: '15' }
      ])
    }
  })

  // 4. Create 7-Day Plan
  const today = new Date()
  today.setHours(0,0,0,0)
  const endDate = new Date(today)
  endDate.setDate(today.getDate() + 6)

  const weeklyPlan = await prisma.weeklyPlan.create({
    data: {
      userId: user.id,
      startDate: today,
      endDate: endDate,
    }
  })

  // Add 7 days
  for(let i=0; i<7; i++) {
    const planDate = new Date(today)
    planDate.setDate(today.getDate() + i)
    
    await prisma.planDay.create({
      data: {
        weeklyPlanId: weeklyPlan.id,
        dayOfWeek: planDate.getDay(),
        date: planDate,
        meals: JSON.stringify([recipe2.id, recipe1.id]), // Breakfast and Dinner
        workoutId: i % 2 === 0 ? workoutHome.id : null, // Every other day workout
        activity: 'Kvällspromenad 20 min'
      }
    })
  }

  // 5. Create DailyLog for today
  await prisma.dailyLog.create({
    data: {
      userId: user.id,
      date: today,
      steps: 4200,
      weight: 75.3,
      mealsEaten: JSON.stringify([recipe2.title]),
      workouts: JSON.stringify([]),
    }
  })

  console.log('Seeding finished.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
