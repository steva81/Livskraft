// Targeted persistence/API tests. Only disposable users and their cascading data are written.
const assert = require('node:assert/strict')
const path = require('node:path')
const Module = require('node:module')
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } })
const resolve = Module._resolveFilename
Module._resolveFilename = function(request, ...args) {
  return resolve.call(this, request.startsWith('@/') ? path.resolve('src', request.slice(2)) : request, ...args)
}
let identity = null
const load = Module._load
Module._load = function(request, ...args) {
  if (request === '@/lib/auth') return {
    getAuthenticatedUserId: async () => identity,
    getAuthSession: async () => identity ? { user: { id: identity }, loginAt: 0 } : null,
  }
  if (request === 'next/cache') return { revalidatePath() {} }
  return load.call(this, request, ...args)
}
process.env.AI_COACH_LIVE_ENABLED = 'false'
const prisma = require('../src/lib/prisma').default
const actions = require('../src/app/actions')
const coach = require('../src/app/api/coach/route')
const { saveCoachExchange, readCoachHistory } = require('../src/lib/coach-history')
const { startOfWeekMonday } = require('../src/lib/plan-types')
const { workoutFits, equipmentFits } = require('../src/lib/training')
const { getCoachReply } = require('../src/lib/coach-service')
const { recipeMeetsConstraints } = require('../src/lib/dietary')
const { refineRecipeData } = require('../prisma/recipe-refinements')
const { aggregateIngredients, clarifyPortionIngredient } = require('../src/lib/shopping')
const users = []
const request = body => new Request('http://localhost/api/coach', { method: 'POST', body: JSON.stringify(body) })
const historyRequest = () => new (require('next/server').NextRequest)('http://localhost/api/coach')
async function main() {
  // Planning now requires an explicitly completed profile; keep these fixtures ready.
  for (let i = 0; i < 2; i++) users.push(await prisma.user.create({ data: { name: 'Refinement test', email: `refinement-${Date.now()}-${i}@example.invalid`,
    currentWeight:80,height:180,activityLevel:'light',trainingLevel:'beginner',trainingLocation:'home',
    preferences:JSON.stringify({primaryGoal:'maintain',planningConfirmed:true}) } }))
  identity = users[0].id
  const first = await actions.getShoppingListState()
  assert(first.items.length > 0)
  const item = first.items[0]
  await actions.setShoppingItemChecked(first.planId, item, true)
  await actions.setShoppingItemChecked(first.planId, item, true)
  await prisma.$disconnect()
  assert.deepEqual((await actions.getShoppingListState()).checked, [item])
  await actions.setShoppingItemChecked(first.planId, item, false)
  assert.deepEqual((await actions.getShoppingListState()).checked, [])
  await actions.setShoppingItemChecked(first.planId, item, true)
  await assert.rejects(actions.setShoppingItemChecked(first.planId, 'fabricated item', true))
  await assert.rejects(actions.setShoppingItemChecked(first.planId, item, 'true'))
  identity = users[1].id
  const second = await actions.getShoppingListState()
  assert.deepEqual(second.checked, [])
  await assert.rejects(actions.setShoppingItemChecked(first.planId, item, true))
  await assert.rejects(actions.setShoppingItemChecked(first.planId, item, false))
  assert.equal(await prisma.shoppingCheck.count({ where: { weeklyPlanId: first.planId } }), 1)
  identity = users[0].id
  const future = await actions.getWeeklyPlan(true)
  await assert.rejects(actions.setShoppingItemChecked(future.id, item, true))
  assert.equal(await prisma.shoppingCheck.count({ where: { weeklyPlanId: future.id } }), 0)
  const day = await prisma.planDay.findFirst({ where: { weeklyPlanId: first.planId } })
  // Removing all planned meals makes old checks invisible and rejects stale writes.
  await prisma.planDay.updateMany({ where: { weeklyPlanId: first.planId }, data: { meals: '[]' } })
  assert.deepEqual((await actions.getShoppingListState()).checked, [])
  await assert.rejects(actions.setShoppingItemChecked(first.planId, item, true))
  await prisma.planDay.update({ where: { id: day.id }, data: { meals: day.meals } })
  console.log('PASS shopping reload, check/uncheck, idempotency, user/week isolation and stale rows')

  const response = await coach.POST(request({ message: 'Jag hann inte träna idag.', userId: users[1].id }))
  const sent = await response.json()
  assert.equal(sent.saved, true)
  assert.match(sent.reply, /inte ta igen/)
  assert.equal((await readCoachHistory(users[0].id)).length, 2)
  assert.equal((await readCoachHistory(users[1].id)).length, 0)
  await prisma.$disconnect()
  const restored = await coach.GET(historyRequest())
  assert.equal(restored.headers.get('Cache-Control'), 'no-store')
  assert.equal((await restored.json()).messages[1].text, sent.reply)
  assert.equal((await coach.POST(request({ message: 'x'.repeat(2001) }))).status, 400)
  identity = users[1].id
  assert.deepEqual((await (await coach.GET(historyRequest())).json()).messages, [])
  await coach.DELETE()
  assert.equal((await readCoachHistory(users[0].id)).length, 2)
  for (let i = 0; i < 51; i++) await saveCoachExchange(users[0].id, `Question ${i}`, `Reply ${i}`)
  const history = await readCoachHistory(users[0].id)
  assert.equal(history.length, 100)
  assert.equal(history[0].text, 'Question 1')
  assert.equal(history[99].text, 'Reply 50')
  identity = users[0].id
  await coach.DELETE()
  assert.deepEqual(await readCoachHistory(identity), [])
  identity = null
  assert.deepEqual(await actions.getShoppingList(), [])
  await assert.rejects(actions.getShoppingListState())
  await assert.rejects(actions.setShoppingItemChecked(first.planId, item, true))
  for (const response of [await coach.GET(), await coach.DELETE(), await coach.POST(request({ message: 'Hej' }))]) assert.equal(response.status, 401)
  console.log('PASS Coach atomic pairs, reload, session ownership, retention, deletion, validation and unauthenticated access')

  const workout = { id: 'test', title: 'Hantelpass', type: 'home', level: 'intermediate', duration: 20, exercises: '[{"name":"Hantelpress"}]' }
  assert(!workoutFits(workout, 'beginner', 'hantlar', 30))
  assert(!equipmentFits(workout, 'hantlar, saknar hantlar'))
  assert(equipmentFits(workout, 'hantlar men ingen bänk'))
  assert(!equipmentFits({ ...workout, exercises: 'broken' }, 'hantlar'))
  assert(!equipmentFits({ ...workout, exercises: '[]' }, 'hantlar'))
  assert(!equipmentFits({ ...workout, exercises: '[null]' }, 'hantlar'))
  assert(equipmentFits({ ...workout, exercises: '[{"name":"Rodd med gummiband"}]' }, 'resistansband'))
  assert(equipmentFits({ ...workout, exercises: '[{"name":"Pull-ups"}]' }, 'chinsstång'))
  const context = { userName: 'Test', restrictions: [], dislikedFoods: [], stepGoal: 8000, todayMeals: [], todayWorkout: null, completedWorkoutsThisWeek: 0, workouts: [workout], trainingLevel: 'beginner', trainingLocation: 'home', homeEquipment: 'hantlar', workoutMinutes: 30 }
  assert.match(await getCoachReply('Jag vill träna i 20 minuter', context), /inget pass/)
  assert.match(await getCoachReply('Kan jag ändra min medicin?', context), /vårdkontakt/)
  assert.match(await getCoachReply('Jag åt för mycket', context), /hoppa inte över mat/)
  const places={...context,language:'en',workouts:[{...workout,title:'Home fixture',level:'beginner'},{...workout,id:'gym',title:'Gym fixture',type:'gym',level:'beginner'}]}
  assert.match(await getCoachReply('I want to train at the gym for 20 minutes', places), /Gym fixture/)
  assert.match(await getCoachReply('I want to train at home for 20 minutes', {...places,trainingLocation:'gym'}), /Home fixture/)
  console.log('PASS shared training matching, aliases, conservative malformed data and Coach safety')

  const recipes = await prisma.recipe.findMany()
  const soup = recipes.find(recipe => recipe.title === 'Röd lins-soppa')
  assert(soup && !JSON.parse(soup.tags).includes('gluten-free'))
  assert(!recipeMeetsConstraints(soup, ['gluten-free'], []))
  assert(!recipeMeetsConstraints(soup, ['allergy:selleri'], []))
  for (const recipe of recipes) assert.deepEqual(refineRecipeData({ ...recipe, ...refineRecipeData(recipe) }), refineRecipeData(recipe))
  assert.match(clarifyPortionIngredient('1 port äggnudlar'), /^1 portion äggnudlar/)
  assert.deepEqual(aggregateIngredients([{ ingredients: '["1 port äggnudlar","1 portion äggnudlar"]' }]), ['2 portioner äggnudlar (mängd enligt förpackningens portionsangivelse)'])
  // Current and generated future plans still respect the shared training matcher.
  for (const plan of await prisma.weeklyPlan.findMany({ where: { userId: { in: users.map(user => user.id) } }, include: { planDays: true } })) {
    assert(plan.startDate >= startOfWeekMonday())
    for (const day of plan.planDays.filter(day => day.workoutId)) {
      const selected = await prisma.workout.findUnique({ where: { id: day.workoutId } })
      assert.equal(selected.level, 'beginner')
    }
  }
  console.log('PASS ingredient-backed metadata, conservative dietary filters, portions and generated-plan levels')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => {
  await prisma.user.deleteMany({ where: { id: { in: users.map(user => user.id) } } })
  await prisma.$disconnect()
})
