import { parseStringList } from "./dietary"

export type WorkoutCandidate = { id: string; title: string; type: string; level: string; duration: number; exercises: string }

export function levelFits(workoutLevel: string, userLevel: string): boolean {
  const rank: Record<string, number> = { beginner: 0, intermediate: 1, advanced: 2 }
  return workoutLevel in rank && userLevel in rank && rank[workoutLevel] <= rank[userLevel]
}

// Gym means standard gym access. Free-text equipment applies only at home.
export function equipmentFits(workout: WorkoutCandidate, homeEquipment: string): boolean {
  if (workout.type === "gym") return true
  const text = workout.exercises.toLowerCase()
  const equipment = homeEquipment.toLowerCase()
  const required = ["hantel", "kettlebell", "gummiband", "skivstång", "pullup", "bänk"]
  return required.every(item => !text.includes(item) || equipment.includes(item) ||
    (item === "bänk" && text.includes("vägg eller")))
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
