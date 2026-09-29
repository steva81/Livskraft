import { getAuthenticatedUserId } from "@/lib/auth"
import { photoMealProvider } from "@/lib/photo-meal-provider"
import { MAX_PHOTO_BYTES } from "@/lib/photo-meals"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } })

export async function GET() {
  if (!await getAuthenticatedUserId()) return reply({ error: "unauthorized" }, 401)
  return reply({ available: photoMealProvider().available })
}

export async function POST(request: Request) {
  if (!await getAuthenticatedUserId()) return reply({ error: "unauthorized" }, 401)
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ error: "forbidden" }, 403)
  const provider = photoMealProvider()
  if (!provider.available) return reply({ error: "unavailable" }, 503)
  // Raw image body avoids filenames and bounds even chunked requests.
  const reader = request.body?.getReader()
  if (!reader) return reply({ error: "image_type" }, 400)
  const chunks: Uint8Array[] = []; let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > MAX_PHOTO_BYTES) return reply({ error: "image_size" }, 413)
      chunks.push(value)
    }
    const estimate = await provider.analyze(Buffer.concat(chunks), request.headers.get("content-type") ?? "", request.headers.get("x-photo-language") === "en" ? "en" : "sv")
    return reply({ estimate })
  } catch (error) {
    const code = error instanceof Error ? error.message : "provider_failure"
    return reply({ error: ["image_type", "image_size", "invalid_response"].includes(code) ? code : "provider_failure" }, 400)
  } finally { await reader.cancel() }
}
