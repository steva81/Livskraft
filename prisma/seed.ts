import { PrismaClient } from "@prisma/client"
import { hashPassword } from "../src/lib/password"
import { recipeInstructions } from "./recipe-instructions"

const prisma = new PrismaClient()

async function main() {
  console.log("Seeding database...")

  const user = await prisma.user.upsert({
    where: { email: "anna@demo.com" }, update: {},
    create: {
      name: "Anna (Demo)",
      email: "anna@demo.com",
      password: await hashPassword("password123"),
      mode: "simple",
      currentWeight: 75.5,
      targetWeight: 68.0,
      timeframeWeeks: 12,
      height: 168,
      waist: 85,
      activityLevel: "moderate",
      stepGoal: 8000,
      trainingLocation: "both",
      trainingLevel: "beginner",
      dietRestrictions: JSON.stringify(["lactose-free"]),
      dislikedFoods: JSON.stringify(["svamp", "lever"]),
      lifestyle: JSON.stringify(["office-worker", "family"]),
    },
  })

  const recipeLibrary = [
      {
        title: "Krämig Havregröt med Bär",
        description: "Mättande frukost som ger bra energi.",
        prepTime: 10,
        ingredients: JSON.stringify(["1 dl havregryn", "2 dl vatten", "1 dl frysta hallon", "1 msk linfrön", "1 dl laktosfri mjölk"]),
        instructions: JSON.stringify(["Blanda havregryn och vatten.", "Koka upp.", "Rör ner bär.", "Servera med laktosfri mjölk."]),
        nutrition: JSON.stringify({ calories: 320, protein: 12, carbs: 45, fat: 8 }),
        tags: JSON.stringify(["breakfast", "vegetarian", "lactose-free"]),
      },
      {
        title: "Tofu-wok med ris",
        description: "Snabb middag utan nötter, mejeri eller kött.",
        prepTime: 20,
        ingredients: JSON.stringify(["200g tofu", "1 dl ris", "100g broccoli", "1 paprika", "2 msk glutenfri soja", "1 vitlöksklyfta"]),
        instructions: JSON.stringify(["Koka riset.", "Tärna tofun och stek.", "Woka grönsaker.", "Blanda med soja."]),
        nutrition: JSON.stringify({ calories: 430, protein: 24, carbs: 48, fat: 14 }),
        tags: JSON.stringify(["dinner", "quick", "vegetarian", "vegan", "lactose-free", "gluten-free"]),
      },
      {
        title: "Kikärtsgryta med tomat",
        description: "Enkel lunch som går att värma eller äta rumstempererad.",
        prepTime: 25,
        ingredients: JSON.stringify(["1 burk kikärtor", "400g krossade tomater", "1 lök", "1 tsk spiskummin", "1 dl ris"]),
        instructions: JSON.stringify(["Fräs löken.", "Tillsätt kikärtor och tomat.", "Krydda och sjud 15 min.", "Servera med ris."]),
        nutrition: JSON.stringify({ calories: 410, protein: 18, carbs: 62, fat: 8 }),
        tags: JSON.stringify(["lunch", "dinner", "vegetarian", "vegan", "lactose-free", "gluten-free"]),
      },
      {
        title: "Snabb Kycklingwok med Nudlar",
        description: "Enkel och god wok som passar perfekt efter jobbet.",
        prepTime: 20,
        ingredients: JSON.stringify(["200g kycklingbröst", "1 port äggnudlar", "100g broccoli", "2 msk glutenfri soja", "1 vitlöksklyfta"]),
        instructions: JSON.stringify(["Strimla kycklingen och stek.", "Koka nudlarna.", "Dela broccolin.", "Blanda ner nudlar och soja."]),
        nutrition: JSON.stringify({ calories: 450, protein: 45, carbs: 40, fat: 12 }),
        tags: JSON.stringify(["dinner", "quick", "lactose-free"]),
      },
      {
        title: "Lax med rostad potatis",
        description: "Middag med fisk, potatis och grönsaker.",
        prepTime: 30,
        ingredients: JSON.stringify(["150g lax", "300g potatis", "1 broccoli", "1 msk rapsolja", "citron"]),
        instructions: JSON.stringify(["Ugnslaga laxen.", "Rosta potatisen.", "Ånga broccolin.", "Servera med citron."]),
        nutrition: JSON.stringify({ calories: 540, protein: 35, carbs: 50, fat: 18 }),
        tags: JSON.stringify(["dinner", "lactose-free", "gluten-free"]),
      },
      {
        title: "Röd lins-soppa",
        description: "Värmande lunch utan nötter och mejeri.",
        prepTime: 25,
        ingredients: JSON.stringify(["2 dl röda linser", "1 lök", "2 morötter", "1 liter färdigblandad grönsaksbuljong", "1 tsk gurkmeja"]),
        instructions: JSON.stringify(["Fräs lök och morot.", "Tillsätt linser och buljong.", "Koka 15 min.", "Mixa lätt."]),
        nutrition: JSON.stringify({ calories: 280, protein: 16, carbs: 40, fat: 4 }),
        tags: JSON.stringify(["lunch", "vegetarian", "vegan", "lactose-free", "gluten-free"]),
      },
      {
        title: "Spenatomelett med tomat",
        description: "Proteinrik lunch på några minuter.",
        prepTime: 8,
        ingredients: JSON.stringify(["2 ägg", "en näve spenat", "1 tomat", "1 tsk rapsolja", "svartpeppar"]),
        instructions: JSON.stringify(["Vispa äggen.", "Fräs spenat.", "Häll över ägg och tomat.", "Stek tills den stelnat."]),
        nutrition: JSON.stringify({ calories: 240, protein: 16, carbs: 4, fat: 16 }),
        tags: JSON.stringify(["lunch", "breakfast", "quick", "vegetarian", "lactose-free", "gluten-free"]),
      },
      {
        title: "Quinoasallad med gurka",
        description: "Matig sallad som tål en stund i lunchlådan.",
        prepTime: 20,
        ingredients: JSON.stringify(["1 dl quinoa", "1 gurka", "10 körsbärstomater", "1 msk olivolja", "citron"]),
        instructions: JSON.stringify(["Koka quinoa.", "Skär grönsaker.", "Blanda med olja och citron."]),
        nutrition: JSON.stringify({ calories: 360, protein: 12, carbs: 48, fat: 12 }),
        tags: JSON.stringify(["lunch", "vegetarian", "vegan", "lactose-free", "gluten-free"]),
      },
      {
        title: "Jordnötstofu med ris",
        description: "Demo-recept med nötter — ska filtreras bort vid nötallergi.",
        prepTime: 20,
        ingredients: JSON.stringify(["200g tofu", "2 msk jordnötssmör", "1 dl ris", "soja"]),
        instructions: JSON.stringify(["Koka ris.", "Stek tofu.", "Rör ner jordnötssmör och soja."]),
        nutrition: JSON.stringify({ calories: 520, protein: 26, carbs: 50, fat: 22 }),
        tags: JSON.stringify(["dinner", "vegetarian", "vegan", "lactose-free"]),
      },
      {
        title: "Halloumisallad",
        description: "Vegetariskt men innehåller ost — filtreras vid laktosfri kost.",
        prepTime: 15,
        ingredients: JSON.stringify(["100g halloumi", "sallad", "tomat", "gurka", "olivolja"]),
        instructions: JSON.stringify(["Stek halloumin.", "Blanda salladen.", "Lägg osten ovanpå."]),
        nutrition: JSON.stringify({ calories: 390, protein: 20, carbs: 8, fat: 30 }),
        tags: JSON.stringify(["lunch", "vegetarian"]),
      },
      {
        title: "Bönchili med ris",
        description: "Mättande middag som fungerar för de flesta restriktioner.",
        prepTime: 30,
        ingredients: JSON.stringify(["1 burk svarta bönor", "400g krossade tomater", "1 paprika", "1 dl ris", "chili"]),
        instructions: JSON.stringify(["Fräs paprika.", "Tillsätt bönor och tomat.", "Sjud 15 min.", "Servera med ris."]),
        nutrition: JSON.stringify({ calories: 440, protein: 20, carbs: 70, fat: 6 }),
        tags: JSON.stringify(["dinner", "lunch", "vegetarian", "vegan", "lactose-free", "gluten-free"]),
      },
  ]
  for (const recipe of recipeLibrary) {
    const instructions = JSON.stringify(recipeInstructions[recipe.title] ?? JSON.parse(recipe.instructions))
    const existing = await prisma.recipe.findFirst({ where: { title: recipe.title } })
    if (!existing) await prisma.recipe.create({ data: { ...recipe, instructions } })
    else await prisma.recipe.update({ where: { id:existing.id }, data: {
      instructions,
      ingredients: existing.ingredients.replaceAll("1 liter grönsaksbuljong","1 liter färdigblandad grönsaksbuljong"),
    } })
  }

  const workoutLibrary = [
      {
        title: "10-minuters hemmapass",
        type: "home",
        level: "beginner",
        duration: 10,
        exercises: JSON.stringify([
          { name: "Armhävningar mot vägg eller stabil bänk", sets: 2, reps: "8-12", durationMin: 2 },
          { name: "Knäböj", sets: 2, reps: "12-15", durationMin: 3 },
          { name: "Plankan", sets: 2, reps: "20 sek", durationMin: 2 },
        ]),
      },
      {
        title: "Hemmaträning: Helkropp",
        type: "home",
        level: "beginner",
        duration: 20,
        exercises: JSON.stringify([
          { name: "Armhävningar", sets: 3, reps: "10-15", durationMin: 5 },
          { name: "Knäböj", sets: 3, reps: "15-20", durationMin: 6 },
          { name: "Plankan", sets: 3, reps: "45 sek", durationMin: 4 },
        ]),
      },
      {
        title: "Hemmaträning: Stärkande",
        type: "home",
        level: "intermediate",
        duration: 30,
        exercises: JSON.stringify([
          { name: "Utfall", sets: 3, reps: "10/ben", durationMin: 8 },
          { name: "Armhävningar med höften högt", sets: 3, reps: "8-12", durationMin: 7 },
          { name: "Höftlyft", sets: 3, reps: "12-15", durationMin: 7 },
        ]),
      },
      {
        title: "Gym: Underkropp",
        type: "gym",
        level: "intermediate",
        duration: 45,
        exercises: JSON.stringify([
          { name: "Knäböj med skivstång", sets: 4, reps: "8-10", durationMin: 12 },
          { name: "Benpress", sets: 3, reps: "10-12", durationMin: 10 },
          { name: "Vadpress", sets: 3, reps: "15", durationMin: 8 },
        ]),
      },
      {
        title: "Gym: Överkropp",
        type: "gym",
        level: "intermediate",
        duration: 40,
        exercises: JSON.stringify([
          { name: "Bänkpress", sets: 4, reps: "8-10", durationMin: 12 },
          { name: "Latsdrag", sets: 3, reps: "10-12", durationMin: 10 },
          { name: "Axelpress", sets: 3, reps: "10", durationMin: 8 },
        ]),
      },
      {
        title: "Gym: Helkropp nybörjare",
        type: "gym",
        level: "beginner",
        duration: 35,
        exercises: JSON.stringify([
          { name: "Benpress", sets: 3, reps: "10-12", durationMin: 10 },
          { name: "Bröstpress maskin", sets: 3, reps: "10-12", durationMin: 8 },
          { name: "Latsdrag", sets: 3, reps: "10-12", durationMin: 8 },
        ]),
      },
  ]
  for (const workout of workoutLibrary) {
    const existing = await prisma.workout.findFirst({ where: { title:workout.title } })
    if (!existing) await prisma.workout.create({ data:workout })
    else await prisma.workout.update({ where:{id:existing.id}, data:{exercises:existing.exercises.replaceAll("Armhävningar mot bänk","Armhävningar mot vägg eller stabil bänk").replaceAll("Glute bridge","Höftlyft").replaceAll("Pike-armhävningar","Armhävningar med höften högt")} })
  }

  if (await prisma.dailyLog.count({ where: { userId: user.id } }) > 0) return

  const recipes = await prisma.recipe.findMany()
  const workouts = await prisma.workout.findMany()
  const breakfast = recipes.find((r) => r.title.includes("Havregröt")) ?? recipes[0]
  const lunch = recipes.find((r) => r.title.includes("lins")) ?? recipes[1]
  const dinnerSafe = recipes.find((r) => r.title.includes("Kycklingwok")) ?? recipes[2]
  const homeWorkout = workouts.find((w) => w.type === "home" && w.duration === 20)
  const gymWorkout = workouts.find((w) => w.type === "gym" && w.level === "beginner")
  const shortWorkout = workouts.find((w) => w.duration === 10)

  const monday = new Date()
  monday.setHours(0, 0, 0, 0)
  const day = monday.getDay()
  monday.setDate(monday.getDate() + (day === 0 ? -6 : 1 - day))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const weeklyPlan = await prisma.weeklyPlan.create({
    data: { userId: user.id, startDate: monday, endDate: sunday },
  })

  for (let i = 0; i < 7; i++) {
    const planDate = new Date(monday)
    planDate.setDate(monday.getDate() + i)
    const rest = i === 2 || i === 6
    const workoutId = rest ? null : i % 2 === 0 ? homeWorkout?.id ?? null : gymWorkout?.id ?? shortWorkout?.id ?? null
    await prisma.planDay.create({
      data: {
        weeklyPlanId: weeklyPlan.id,
        dayOfWeek: planDate.getDay(),
        date: planDate,
        meals: JSON.stringify([
          { slot: "Frukost", recipeId: breakfast.id, title: breakfast.title },
          { slot: "Lunch", recipeId: lunch.id, title: lunch.title },
          { slot: "Middag", recipeId: dinnerSafe.id, title: dinnerSafe.title },
        ]),
        workoutId,
        activity: `Lunchpromenad 20 min · personligt stegmål 8 000`,
      },
    })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  await prisma.dailyLog.create({
    data: {
      userId: user.id,
      date: today,
      steps: 4200,
      weight: 75.3,
      mealsEaten: JSON.stringify(["Krämig Havregröt med Bär"]),
      workouts: JSON.stringify([]),
    },
  })

  console.log("Seeding finished. Demo login: anna@demo.com / password123")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
