import { MAX_PHOTO_BYTES, parsePhotoEstimate } from "./photo-meals"

// Re-encode locally to remove EXIF/location metadata and reduce transmitted pixels.
export async function prepareMealPhoto(file: File): Promise<Blob> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("image_type")
  if (!file.size || file.size > 10 * 1024 * 1024) throw new Error("image_size")
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext("2d")
    if (!context) throw new Error("image_type")
    context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>((resolve,reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("image_type")), "image/jpeg", 0.85))
    if (blob.size > MAX_PHOTO_BYTES) throw new Error("image_size")
    return blob
  } finally { bitmap.close() }
}

export async function analyzeMealPhoto(file: File, language: "sv" | "en", signal: AbortSignal) {
  const body = await prepareMealPhoto(file)
  const response = await fetch("/api/photo-meal", { method: "POST", signal, headers: { "Content-Type": body.type, "x-photo-language": language }, body })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error ?? "provider_failure")
  return parsePhotoEstimate(data.estimate)
}

// Also bounds local decoding and server-action waits; retries keep the same save token.
export async function photoTask<T>(task: Promise<T>, milliseconds = 35000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try { return await Promise.race([task, new Promise<never>((_,reject) => { timer = setTimeout(() => reject(new Error("timeout")), milliseconds) })]) }
  finally { clearTimeout(timer) }
}
