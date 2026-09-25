// Apply only the ingredient-backed beta corrections; do not reseed user data.
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } })
const { PrismaClient } = require('@prisma/client')
const { refineRecipeData } = require('../prisma/recipe-refinements')
const prisma = new PrismaClient()
async function main() {
  let changed = 0
  for (const recipe of await prisma.recipe.findMany()) {
    const data = refineRecipeData(recipe)
    if (Object.entries(data).some(([key, value]) => recipe[key] !== value)) {
      await prisma.recipe.update({ where: { id: recipe.id }, data })
      changed++
    }
  }
  console.log(`Updated ${changed} recipes; nutrition and user data unchanged.`)
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => prisma.$disconnect())
