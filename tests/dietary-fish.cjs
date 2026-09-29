// Pure dietary regressions: no database or external services.
const assert = require('node:assert/strict')
require('ts-node').register({transpileOnly:true,compilerOptions:{module:'CommonJS',moduleResolution:'node'}})
const {recipeMeetsConstraints} = require('../src/lib/dietary')
const {expandedRecipes} = require('../prisma/expanded-recipes')
const {recipeQuantities} = require('../prisma/recipe-quality')
const recipe = (...items) => ({ingredients:JSON.stringify(items),tags:'["vegan","gluten-free"]'})

const missed = [
  'sej', 'öring', 'sill', 'strömming', 'sardell', 'sardin', 'makrill',
  'kolja', 'hälleflundra', 'rödspätta', 'abborre', 'gädda', 'gös', 'sik',
  'regnbåge', 'ål', 'salmon', 'cod', 'tuna', 'trout', 'pollock', 'coalfish',
  'herring', 'anchovy', 'anchovies', 'sardines', 'mackerel', 'haddock',
  'halibut', 'plaice', 'perch', 'pike', 'zander', 'whitefish', 'eel',
  'fish sauce', 'fish stock', 'sejfilé', 'öringfiléer', 'sillrom', 'sardellpastej',
]
for (const restriction of ['allergy:fisk','allergy:fish','ALLERGY:FISH']) {
  for (const name of [...missed,'lax','torsk','tonfisk','ansjovis','fiskbuljong']) {
    assert.equal(recipeMeetsConstraints(recipe(`200 g ${name}`),[restriction],[]),false,`${restriction}: ${name}`)
    assert.equal(recipeMeetsConstraints(recipe(`200 g ${name.toUpperCase()}`),[restriction],[]),false,`${restriction}: uppercase ${name}`)
  }
  for (const items of [
    ['ris','kikärtor','grönkål','dill'], ['rice','chickpeas','kale','dill'],
    ['sallad','broccoli','olivolja'], ['tofu','potatis','morot'],
    ['seitan','basilika','persilja'], ['milk','eggs'],
  ]) assert.equal(recipeMeetsConstraints(recipe(...items),[restriction],[]),true,items.join(', '))
  assert.equal(recipeMeetsConstraints({ingredients:'[]',tags:'[]'},[restriction],[]),false)
  assert.equal(recipeMeetsConstraints({ingredients:'invalid',tags:'[]'},[restriction],[]),false)
}
console.log('PASS Swedish/English fish allergy names, compounds, case and non-fish controls')

// All authored recipe ingredient lists, without executing the database seed.
let fishRecipes=0,nonFishRecipes=0
for (const r of [...expandedRecipes,...Object.entries(recipeQuantities).map(([title,items])=>({...recipe(...items),title}))]) {
  const hasFish = /lax|torsk|tonfisk/.test(r.ingredients.toLowerCase())
  for (const restriction of ['allergy:fisk','allergy:fish']) {
    assert.equal(recipeMeetsConstraints(r,[restriction],[]),!hasFish,r.title)
  }
  if(hasFish)fishRecipes++;else nonFishRecipes++
}
assert(fishRecipes>0 && nonFishRecipes>0)
console.log(`PASS authored library: ${fishRecipes} fish recipes rejected; ${nonFishRecipes} non-fish recipes retained`)

// The new vocabulary applies only to fish allergy; other rules retain their behavior.
assert(recipeMeetsConstraints(recipe('sej'),[],[]))
assert(recipeMeetsConstraints(recipe('räkor'),['allergy:fisk'],[]))
assert(!recipeMeetsConstraints(recipe('räkor'),['allergy:skaldjur'],[]))
assert(!recipeMeetsConstraints(recipe('lax'),['vegetarian'],[]))
assert(!recipeMeetsConstraints(recipe('mjölk'),['vegan'],[]))
assert(!recipeMeetsConstraints(recipe('mjölk'),['lactose-free'],[]))
assert(!recipeMeetsConstraints(recipe('vetemjöl'),['gluten-free'],[]))
assert(!recipeMeetsConstraints(recipe('jordnötter'),['allergy:nuts'],[]))
assert(!recipeMeetsConstraints(recipe('ris'),['allergy:unknown'],[]))
assert(!recipeMeetsConstraints(recipe('ris'),['halal'],[]))
assert(!recipeMeetsConstraints(recipe('ris'),[],['rice']))
console.log('PASS other dietary restrictions, dislikes and separate shellfish category preserved')
