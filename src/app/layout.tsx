import { getAuthSession } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { readPreferences } from "@/lib/preferences"
import type { Metadata } from "next"
import localFont from "next/font/local"
import "./globals.css"
import { Providers } from "@/lib/providers"

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
})
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
})

export const metadata: Metadata = {
  title: "Livskraft – Din plan. Ditt liv. Ditt mål.",
  description: "Personlig kost, träning och vardagsrörelse – anpassad efter hur ditt liv faktiskt ser ut.",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await getAuthSession()
  const user = session?.user?.id ? await prisma.user.findUnique({
    where: { id: session.user.id }, select: { preferences: true },
  }) : null
  const language = readPreferences(user?.preferences ?? null).language
  return (
    <html lang={language}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers session={session} language={language}>{children}</Providers>
      </body>
    </html>
  )
}
