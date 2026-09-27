import type { Nutrition } from "./nutrition"

// A provider returns suggestions only. Persisting always requires an explicit user review.
export type PhotoSuggestion = { name: string; components: string; portion: string; nutrition: Nutrition; uncertainties: string[] }
export interface PhotoMealProvider {
  available: boolean
  analyze(image: Blob, signal?: AbortSignal): Promise<PhotoSuggestion[]>
}
export const photoMealProvider: PhotoMealProvider = {
  available: false,
  async analyze() { throw new Error("Photo analysis is not configured. Enter and review the meal manually.") },
}
