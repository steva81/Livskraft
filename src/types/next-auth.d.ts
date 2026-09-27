import "next-auth"
import "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    loginAt?: number
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    loginAt?: number
    credentialVersion?: string
  }
}
