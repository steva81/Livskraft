const assert = require('node:assert/strict')
require('ts-node').register({transpileOnly:true,compilerOptions:{module:'CommonJS',moduleResolution:'node'}})
const {readPreferences, validPreferences, defaultPreferences} = require('../src/lib/preferences')
const year = new Date().getFullYear()
const valid = {...defaultPreferences, language:'en', health:'type1', primaryGoal:'maintain', planningConfirmed:true,
  homeVisited:false, birthYear:year-40, sexForEnergy:'female', dailySteps:7000, cookingMinutes:45,
  workoutMinutes:40, trainingDays:4, budget:'low', likedFoods:'beans', equipment:'hantlar', workSchedule:'natt',
  measurements:'legacy note', mealSlots:['Lunch','Middag'], trackedMeasurements:['hip','arm']}
const read = value => readPreferences(JSON.stringify(value))
assert.deepEqual(read(valid),valid)
// Every field is independently invalidated while all other valid fields survive.
const invalid = {language:'fr',health:'unsupported',primaryGoal:'unknown',planningConfirmed:'true',homeVisited:1,
  birthYear:year-101,sexForEnergy:'unknown',dailySteps:'7000',cookingMinutes:0,workoutMinutes:121,trainingDays:6,
  budget:'unlimited',likedFoods:[],equipment:null,workSchedule:'remote',measurements:'x'.repeat(501),
  mealSlots:['Lunch','unknown'],trackedMeasurements:['hip','unknown']}
for (const [key,value] of Object.entries(invalid)) {
  const expected = {...valid}
  if (Object.hasOwn(defaultPreferences,key)) expected[key]=defaultPreferences[key]
  else delete expected[key]
  assert.deepEqual(read({...valid,[key]:value}),expected,key)
  assert.equal(validPreferences(read({...valid,[key]:value})),true,key)
}
assert.deepEqual(read({...valid,birthYear:null,trainingDays:-1}),
  {...Object.fromEntries(Object.entries(valid).filter(([k])=>k!=='birthYear')),trainingDays:3})
for (const raw of [null,'','{bad','null','[]','["en"]','42','true','"legacy"']) {
  assert.deepEqual(readPreferences(raw),defaultPreferences,raw)
}
const legacy = read({language:'en',health:'type2',measurements:'hip 98 cm'})
assert.deepEqual(legacy,{...defaultPreferences,language:'en',health:'type2',measurements:'hip 98 cm'})
assert.equal(legacy.primaryGoal,undefined)
assert.equal(legacy.planningConfirmed,undefined)
assert.equal(legacy.birthYear,undefined)
assert.deepEqual(read({...valid,unknownSetting:'ignored'}),valid)
for (const health of [['type1'],{toString:null},{valueOf:'type1'},null]) {
  assert.deepEqual(read({...valid,health}),{...valid,health:defaultPreferences.health})
}
for (const trackedMeasurements of [[['hip']],[{toString:null}],null]) {
  assert.deepEqual(read({...valid,trackedMeasurements}),{...valid,trackedMeasurements:[]})
}
assert.deepEqual(read({...valid,trackedMeasurements:['arm','hip','arm']}).trackedMeasurements,['hip','arm'])
assert.equal(validPreferences({...valid,language:'fr'}),false,'writes must still reject invalid input')
const defaults = readPreferences(null)
defaults.mealSlots.push('Mellanmål')
defaults.trackedMeasurements.push('hip')
assert.deepEqual(readPreferences(null),defaultPreferences,'caller mutations must not alter defaults')
console.log('PASS F06 valid, per-field fallback, expired birth year, malformed/legacy JSON, optional choices and existing validation rules')
