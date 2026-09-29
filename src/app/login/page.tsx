"use client"
import { Localize, LanguageSelector } from "@/lib/i18n/provider"

import { signIn } from "next-auth/react"
import { useEffect, useState, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useRouter, useSearchParams } from "next/navigation"

function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => { setHydrated(true) }, [])
  const router = useRouter()
  const params = useSearchParams()
  const justCreated = params.get("created") === "1"

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hydrated || loading) return
    setError("")
    setLoading(true)
    try {
      const res = await signIn("credentials", { redirect: false, email, password, callbackUrl: "/home" })
      if (!res?.ok || res.error) {
        setError("Fel e-post eller lösenord.")
      } else {
        router.push("/home")
      }
    } catch {
      setError("Kunde inte logga in. Försök igen.")
    } finally {
      setLoading(false)
    }
  }

  return <Localize>{(
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50/50">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <LanguageSelector />
          <CardTitle className="text-2xl">Logga in</CardTitle>
          {justCreated && (
            <CardDescription className="text-green-700 bg-green-50 p-2 rounded-md mt-1">
              Ditt konto är skapat! Logga in för att komma igång.
            </CardDescription>
          )}
          {!justCreated && (
            <CardDescription>
              Demo: anna@demo.com / password123
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {/* Fail closed before hydration; native fallback must never use GET. */}
          <form method="post" action="/login" onSubmit={handleLogin}>
            <fieldset disabled={!hydrated || loading} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="text-sm font-medium block mb-1">E-post</label>
              <input
                type="email"
                id="login-email" name="email" autoComplete="username"
                className="w-full p-2 border rounded-md"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="login-password" className="text-sm font-medium block mb-1">Lösenord</label>
              <input
                type="password"
                id="login-password" name="password" autoComplete="current-password"
                className="w-full p-2 border rounded-md"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p role="alert" className="text-red-500 text-sm">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Loggar in…" : "Logga in"}
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={() => { setEmail("anna@demo.com"); setPassword("password123") }}>Fyll i demokonto</Button>
            <p className="text-sm text-muted-foreground mt-3 text-center">
              Ny här?{" "}
              <a className="text-primary underline" href="/onboarding">
                Skapa din plan
              </a>
            </p>
            </fieldset>
            <noscript><p>JavaScript krävs för säker inloggning. Aktivera JavaScript och ladda om sidan.</p></noscript>
          </form>
        </CardContent>
      </Card>
    </div>
  )}</Localize>
}

export default function LoginPage() {
  return <Localize>{(
    <Suspense>
      <LoginForm />
    </Suspense>
  )}</Localize>
}
