import { parseStringList } from "./dietary"

export type WorkoutCandidate = { id: string; title: string; type: string; level: string; duration: number; exercises: string }

export function levelFits(workoutLevel: string, userLevel: string): boolean {
  const rank: Record<string, number> = { beginner: 0, intermediate: 1, advanced: 2 }
  return workoutLevel in rank && userLevel in rank && rank[workoutLevel] <= rank[userLevel]
}

// Gym means standard gym access. Free-text equipment applies only at home.
export function equipmentFits(workout: WorkoutCandidate, homeEquipment: string): boolean {
  if (workout.type === "gym") return true
  if (workout.type !== "home") return false
  let names: string[]
  try {
    const exercises = JSON.parse(workout.exercises) as {name:string}[]
    if (!Array.isArray(exercises) || !exercises.length || exercises.some(ex => !ex || typeof ex.name !== "string" || !ex.name.trim())) return false
    names = exercises.map(ex => ex.name.toLowerCase())
  } catch { return false }
  const normalize = (text: string) => text.toLowerCase().replaceAll("hantlar", "hantel")
    .replace(/pull[- ]?up(?:stång)?|chinsstång/g, "pullup").replace(/resistansband|träningsband/g, "gummiband")
  names = names.map(normalize)
  const parts = normalize(homeEquipment).split(/[,;\n]|\bmen\b/)
  const available = parts
    .filter(part => !/\b(?:ingen|inga|inget|utan|saknar|inte)\b/.test(part))
  const unavailable = parts.filter(part => /\b(?:ingen|inga|inget|utan|saknar|inte)\b/.test(part))
  const required = ["hantel", "kettlebell", "gummiband", "skivstång", "pullup", "bänk", "stol"]
  return names.every(name => required.every(item => !name.includes(item) ||
    (available.some(part => part.includes(item)) && !unavailable.some(part => part.includes(item))) ||
    (item === "bänk" && /vägg eller (?:stabil )?bänk/.test(name))))
}

export function workoutFits(workout: WorkoutCandidate, level: string, equipment: string, minutes: number): boolean {
  return levelFits(workout.level, level) && equipmentFits(workout, equipment) && workout.duration <= minutes
}

export function workoutInstructions(workout: WorkoutCandidate): string {
  try {
    const exercises = JSON.parse(workout.exercises) as { name: string; sets: number; reps: string }[]
    return exercises.map(e => `${e.name}: ${e.sets} × ${e.reps}`).join("; ")
  } catch { return parseStringList(workout.exercises).join("; ") }
}
