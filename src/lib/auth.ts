import { createHash } from "node:crypto"
import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { getServerSession } from "next-auth"
import prisma from "@/lib/prisma"
import { hashPassword, verifyPassword } from "./password"

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "E-post", type: "email", placeholder: "anna@demo.com" },
        password: { label: "Lösenord", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.trim().toLowerCase() },
        })

        if (credentials.password.length > 256) return null
        // Migrate existing local beta credentials after a successful login.
        const valid = user?.password && (user.password.startsWith("scrypt:")
          ? await verifyPassword(credentials.password, user.password)
          : user.password === credentials.password)
        if (user && valid) {
          if (!user.password?.startsWith("scrypt:")) {
            await prisma.user.update({ where: { id: user.id }, data: { password: await hashPassword(credentials.password) } })
          }
          return { id: user.id, name: user.name, email: user.email }
        }

        return null
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.loginAt = Date.now()
        const record = await prisma.user.findUnique({where:{id:user.id}})
        token.credentialVersion = createHash("sha256").update(record?.password ?? "").digest("hex")
      }
      if (!token.credentialVersion) token.id = ""
      if (token.id && token.credentialVersion) {
        const record = await prisma.user.findUnique({where:{id:token.id}})
        if (!record || createHash("sha256").update(record.password ?? "").digest("hex") !== token.credentialVersion) token.id = ""
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.id === "string" ? token.id : token.sub || ""
        session.loginAt = token.loginAt
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
}

export async function getAuthSession() {
  return getServerSession(authOptions)
}

export async function getAuthenticatedUserId(): Promise<string | null> {
  const session = await getAuthSession()
  return session?.user?.id ?? null
}
