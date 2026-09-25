// Narrow, repeatable corrections supported by the existing ingredient text.
export function refineRecipeData(recipe: { title: string; ingredients: string; tags: string; description: string }) {
  const ingredients = recipe.ingredients.replaceAll('1 port äggnudlar', '1 portion äggnudlar')
  if (recipe.title === "Röd lins-soppa" && ingredients.includes("färdigblandad grönsaksbuljong") && !ingredients.includes("glutenfri")) {
    return {
      ingredients,
      tags: JSON.stringify((JSON.parse(recipe.tags) as string[]).filter(tag => tag !== "gluten-free")),
      description: "Värmande linssoppa med morot och gurkmeja. Kontrollera buljongens allergenmärkning.",
    }
  }
  return { ingredients, tags: recipe.tags, description: recipe.description }
}
