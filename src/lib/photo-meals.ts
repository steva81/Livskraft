import type { Nutrition } from "./nutrition"

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024
export type PhotoItem = { name: string; estimatedGrams: number | null; calories: number; protein: number; carbs: number; fat: number; fibre: number }
export type PhotoEstimate = { items: PhotoItem[]; total: Nutrition; confidence: "low" | "medium" | "high"; note: string }

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid estimate")
  return value as Record<string, unknown>
}
function text(value: unknown, max: number): string {
  if (typeof value !== "string" || value.length > max) throw new Error("Invalid estimate text")
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").trim()
}
function amount(value: unknown, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > max) throw new Error("Invalid estimate amount")
  return Math.round(value * 10) / 10
}
export function parsePhotoEstimate(value: unknown): PhotoEstimate {
  const data = object(value)
  if (!Array.isArray(data.items) || data.items.length < 1 || data.items.length > 20) throw new Error("No food estimate")
  const items = data.items.map(value => {
    const item = object(value), name = text(item.name, 120)
    if (!name) throw new Error("Missing food name")
    return { name, estimatedGrams: item.estimatedGrams === null ? null : amount(item.estimatedGrams, 5000),
      calories: amount(item.calories, 10000), protein: amount(item.protein, 1000), carbs: amount(item.carbs, 1000), fat: amount(item.fat, 1000), fibre: amount(item.fibre, 1000) }
  })
  // Compute totals from validated items, never trust a contradictory provider total.
  const total: Nutrition = { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: null }
  for (const key of ["calories", "protein", "carbs", "fat", "fibre"] as const) {
    total[key] = amount(items.reduce((sum, item) => sum + item[key], 0), key === "calories" ? 10000 : 1000)
  }
  if (!["low", "medium", "high"].includes(data.confidence as string)) throw new Error("Invalid confidence")
  return { items, total, confidence: data.confidence as PhotoEstimate["confidence"], note: text(data.note, 600) }
}

export function validatePhotoBytes(bytes: Uint8Array, type: string) {
  if (!bytes.length || bytes.length > MAX_PHOTO_BYTES) throw new Error("image_size")
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end))
  const valid = type === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : type === "image/png" ? [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v)
    : type === "image/webp" && ascii(0,4) === "RIFF" && ascii(8,12) === "WEBP"
  if (!valid) throw new Error("image_type")
}
