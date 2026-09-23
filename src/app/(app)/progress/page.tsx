"use client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LineChart, TrendingDown, Settings2 } from "lucide-react"
import { useMode } from "@/lib/ModeContext"

export default function ProgressPage() {
  const { mode } = useMode()

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Framsteg</h1>
        <p className="text-muted-foreground">Trender, mätningar och din adaptiva vecka.</p>
      </div>

      {/* Adaptive Week */}
      <Card className="border-primary/50 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <Settings2 className="w-5 h-5" /> Adaptiv Vecka
          </CardTitle>
          <CardDescription className="text-gray-700">
            Baserat på dina loggade måltider och träningspass från förra veckan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed">
            Jag ser att du hade svårt att hinna med gympassen på onsdagar, men du höll dig
            jättebra till matplanen!{" "}
            <strong>Förslag inför nästa vecka:</strong> Ska vi byta ut onsdagspasset mot en
            20-minuters hemmaträning istället, så du slipper stressa till gymmet?
          </p>
          <div className="flex gap-3 flex-wrap">
            <Button>Ja, anpassa planen</Button>
            <Button variant="outline" className="bg-white">
              Nej, behåll som det är
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Weight card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-primary" /> Vikt &amp; Trender
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 mb-6">
              <span className="text-4xl font-bold">74.2</span>
              <span className="text-muted-foreground mb-1">kg</span>
            </div>

            {mode === "advanced" ? (
              <div className="space-y-3">
                {/* Simple bar chart mockup */}
                <div className="h-32 bg-gray-100 rounded-md flex items-end p-2 gap-2">
                  {[80, 75, 60, 55, 40, 30].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-primary rounded-t-sm"
                      style={{ height: `${h}%`, opacity: 0.4 + i * 0.12 }}
                    />
                  ))}
                </div>
                <div className="text-xs text-muted-foreground flex justify-between px-1">
                  <span>Mån</span>
                  <span>Sön</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Trenden pekar neråt! Veckosnittet är 0.4 kg lägre än förra veckan.
                Fokusera på trenden, inte den enskilda dagens siffra.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Measurements card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <LineChart className="w-5 h-5 text-primary" /> Mått &amp; Milstolpar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium">Midjemått</span>
              <span className="text-sm text-muted-foreground">−2 cm (senaste månaden)</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium">Genomsnitt steg</span>
              <span className="text-sm text-muted-foreground">8 450 (senaste veckan)</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium">Träningspass</span>
              <span className="text-sm text-muted-foreground">4 av 5 (förra veckan)</span>
            </div>
            {mode === "advanced" && (
              <Button variant="outline" className="w-full mt-2">
                Logga nya mått
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
