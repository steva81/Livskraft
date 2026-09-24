import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Leaf, Activity, Salad } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-4 lg:px-6 h-16 flex items-center border-b">
        <Link className="flex items-center justify-center" href="/">
          <Leaf className="h-6 w-6 text-primary" />
          <span className="ml-2 text-xl font-bold">Livskraft</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <Link className="text-sm font-medium hover:underline underline-offset-4" href="/login">
            Logga in
          </Link>
        </nav>
      </header>
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-primary/5">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center space-y-4 text-center rounded-2xl">
              <div className="space-y-2">
                <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl">
                  Din plan. Ditt liv. Ditt mål.
                </h1>
                <p className="mx-auto max-w-[700px] text-gray-500 md:text-xl dark:text-gray-400 mt-4">
                  Personlig kost, träning och vardagsrörelse – anpassad efter hur ditt liv faktiskt ser ut.
                </p>
              </div>
              <div className="space-x-4 mt-6">
                <Link href="/onboarding">
                  <Button size="lg" className="h-12 px-8">
                    Skapa min plan <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full py-12 md:py-24 lg:py-32 bg-white">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 md:grid-cols-3 max-w-6xl mx-auto">
              <div className="flex flex-col items-center space-y-4 text-center rounded-2xl">
                <div className="p-4 bg-primary/10 rounded-full">
                  <Salad className="h-10 w-10 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">Ät bättre</h2>
                <p className="text-gray-500 dark:text-gray-400">
                  God mat som passar din vardag. Inga extrema dieter, bara hållbara vanor med mat du gillar.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-4 text-center rounded-2xl">
                <div className="p-4 bg-primary/10 rounded-full">
                  <Activity className="h-10 w-10 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">Träna smartare</h2>
                <p className="text-gray-500 dark:text-gray-400">
                  Oavsett om du har 15 minuter hemma eller 60 minuter på gymmet, anpassar vi träningen efter dig.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-4 text-center rounded-2xl">
                <div className="p-4 bg-primary/10 rounded-full">
                  <Leaf className="h-10 w-10 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">Rör dig mer</h2>
                <p className="text-gray-500 dark:text-gray-400">
                  Vardagsrörelse är lika viktigt som hårda pass. Vi hjälper dig hitta balansen för långsiktig hälsa.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          © 2026 Livskraft. Alla rättigheter förbehållna.
        </p>
      </footer>
    </div>
  )
}
