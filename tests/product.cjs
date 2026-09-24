// Product logic regressions; no database writes or external services.
const assert = require('node:assert/strict')
const fs = require('node:fs')
require('ts-node').register({transpileOnly:true,compilerOptions:{module:'CommonJS',moduleResolution:'node'}})
const { aggregateIngredients } = require('../src/lib/shopping')
const { equipmentFits } = require('../src/lib/training')
const { activityGuidance } = require('../src/lib/activity')
const { defaultPreferences } = require('../src/lib/preferences')
const { recipeInstructions } = require('../prisma/recipe-instructions')

const list = (...items) => aggregateIngredients([{ingredients:JSON.stringify(items)}])
assert.deepEqual(list('1/2 gurka','½ gurka'), ['1 gurka'])
assert.deepEqual(list('1 1/2 dl ris','0,5 dl ris','100g ris'), ['2 dl ris','100 g ris'])
assert.deepEqual(list('1 paket tofu','2 paket tofu','200 g tofu'), ['3 paket tofu','200 g tofu'])
assert.deepEqual(list('1 näve spenat','2 nävar spenat'), ['3 nävar spenat'])
assert.deepEqual(list('1 kopp ris'), ['1 kopp ris (till 1 receptportion)'])
assert.deepEqual(list('1/0 dl ris'), ['1/0 dl ris (till 1 receptportion)'])
console.log('PASS fractions and quantities preserve incompatible or unknown units')

const home = (...names) => ({type:'home',exercises:JSON.stringify(names.map(name=>({name,sets:2,reps:'10'})))})
assert(!equipmentFits(home('Hantelpress'), 'kroppsvikt, inga hantlar'))
assert(equipmentFits(home('Hantelpress'), 'hantlar, ingen bänk'))
assert(equipmentFits(home('Armhävningar mot vägg eller stabil bänk'), 'kroppsvikt'))
assert(!equipmentFits(home('Armhävningar mot vägg eller stabil bänk','Bänkpress'), 'kroppsvikt'))
assert(!equipmentFits(home('Dips mot stol'), 'kroppsvikt'))
assert(equipmentFits(home('Dips mot stol'), 'stol'))
assert(equipmentFits({type:'gym',exercises:'Bänkpress'}, 'inga hantlar'))
console.log('PASS negative equipment and optional alternatives are scoped to each exercise')

for (const schedule of ['dagtid','skift','natt']) {
  const week=Array.from({length:7},(_,index)=>activityGuidance({index,training:[0,3,5].includes(index),stepGoal:8000,preferences:{...defaultPreferences,workSchedule:schedule},lifestyle:[],lowSteps:true}))
  assert.equal(new Set(week).size,7)
  assert.equal(week.filter(text=>text.includes('De senaste loggarna')).length,1)
  if(schedule!=='dagtid') assert(week.every(text=>!text.includes('på kvällen')&&!text.includes('på lunchrasten')))
}
console.log('PASS seven varied daily suggestions and flexible shift-work timing')

const seed=fs.readFileSync('prisma/seed.ts','utf8').split('const recipeLibrary = [')[1].split('const workoutLibrary = [')[0]
const titles=[...seed.matchAll(/title: "([^"]+)"/g)].map(match=>match[1])
assert.equal(titles.length,11)
for(const title of titles) {
  const steps=recipeInstructions[title]
  assert(steps?.length>=3,`${title}: missing cooking steps`)
  assert(steps.every(step=>step.trim()) && steps.join(' ').length>200,`${title}: placeholder instructions`)
  assert(steps.some(step=>/minut|°C|förpackning|sjud|medelvärme/.test(step)),`${title}: no useful cooking guidance`)
}
console.log('PASS all eleven seeded recipes have complete cooking instructions')
