import { randomBytes, scrypt as derive, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"

const scrypt = promisify(derive)

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex")
  const key = await scrypt(password, salt, 64) as Buffer
  return `scrypt:${salt}:${key.toString("hex")}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, encoded] = stored.split(":")
  if (scheme !== "scrypt" || !salt || !/^[a-f0-9]{128}$/.test(encoded ?? "")) return false
  const actual = await scrypt(password, salt, 64) as Buffer
  return timingSafeEqual(actual, Buffer.from(encoded, "hex"))
}
