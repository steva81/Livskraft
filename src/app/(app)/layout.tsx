import { Localize } from "@/lib/i18n/provider"
import { NavigationLink as Link } from "@/components/navigation-link"
import { Leaf, Home, Utensils, CalendarDays, Dumbbell, LineChart, MessageCircle, User, ListChecks } from "lucide-react"
import { ModeProvider } from "@/lib/ModeContext"
import { getAuthenticatedUserId } from "@/lib/auth"
import { redirect } from "next/navigation"
import { ModeControl } from "@/components/ModeControl"
import { MobileNavigation } from "@/components/mobile-navigation"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!await getAuthenticatedUserId()) redirect("/login")
  return <Localize>{(
    <ModeProvider>
      <div className="wellness-app flex h-[100dvh] bg-background">
        {/* Desktop Sidebar */}
        <aside className="app-sidebar hidden lg:flex w-64 shrink-0 flex-col border-r bg-white">
          <div className="h-24 flex items-center px-6">
            <Link href="/home" className="brand-link flex items-center gap-3 text-xl text-primary">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white"><Leaf size={21} aria-hidden="true" /></span>Livskraft
            </Link>
          </div>
          <nav className="flex-1 overflow-y-auto py-5">
            <ul className="space-y-1 px-3">
              <li>
                <Link href="/home" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-100">
                  <Home className="h-4 w-4" /> Hem
                </Link>
              </li>
              <li><Link href="/dashboard" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-100"><Utensils className="h-4 w-4" /> Idag</Link></li>
              <li>
                <Link href="/plan" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-100">
                  <ListChecks className="h-4 w-4" /> Veckoplan
                </Link>
              </li>
              <li>
                <Link href="/meals" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-100">
                  <CalendarDays className="h-4 w-4" /> Recept
                </Link>
              </li>
              <li>
                <Link href="/training" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-100">
                  <Dumbbell className="h-4 w-4" /> Träning
                </Link>
              </li>
              <li>
                <Link href="/progress" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-100">
                  <LineChart className="h-4 w-4" /> Framsteg
                </Link>
              </li>
              <li>
                <Link href="/coach" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-100">
                  <MessageCircle className="h-4 w-4" /> Coach
                </Link>
              </li>
              <li className="!mt-6 border-t pt-4 text-muted-foreground"><Link href="/my-plan" className="block rounded-md px-3 py-2 text-sm font-medium">Min plan</Link></li>
              <li className="text-muted-foreground"><Link href="/account" className="block rounded-md px-3 py-2 text-sm font-medium">Kontoinställningar</Link></li>
            </ul>
          </nav>
          <div className="border-t p-4">
            <Link href="/profile" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-100">
              <User className="h-4 w-4" /> Min profil
            </Link>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="app-scroll wellness-content flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10"><ModeControl />{children}</div>

          {/* Mobile Nav */}
          <MobileNavigation />
        </main>
      </div>
    </ModeProvider>
  )}</Localize>
}
