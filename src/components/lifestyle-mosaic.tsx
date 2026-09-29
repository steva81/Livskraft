"use client"

import { WellnessPhoto } from "./wellness-photo"
import { useLanguage } from "@/lib/i18n/provider"

/** Original Livskraft lifestyle assets; captions are localized independently of page content. */
export const lifestyleMedia = {
  cooking: { src: "/images/lifestyle/cooking.webp", position: "50% 50%", sv: "Mat hemma", en: "Cooking at home" },
  meal: { src: "/images/lifestyle/meal.webp", position: "50% 50%", sv: "En stund vid bordet", en: "A moment at the table" },
  balance: { src: "/images/lifestyle/balance.webp", position: "50% 50%", sv: "Rörlighet & balans", en: "Movement & balance" },
  strength: { src: "/images/lifestyle/strength.webp", position: "50% 50%", sv: "Styrka i din takt", en: "Strength at your pace" },
  outdoors: { src: "/images/lifestyle/outdoors.webp", position: "50% 50%", sv: "En runda ute", en: "An outdoor run" },
  calm: { src: "/images/lifestyle/calm.webp", position: "50% 50%", sv: "Promenad i det gröna", en: "A walk in the park" },
} as const

const mosaicClasses = { welcome: "lifestyle-mosaic--welcome", home: "lifestyle-mosaic--home", strip: "lifestyle-mosaic--strip" }

type Theme = keyof typeof lifestyleMedia

export function LifestyleMosaic({ variant = "welcome", themes }: { variant?: "welcome" | "home" | "strip"; themes?: Theme[] }) {
  const { language } = useLanguage()
  const selected = themes ?? (variant === "welcome" ? Object.keys(lifestyleMedia) as Theme[] : ["cooking", "outdoors", "calm"] as Theme[])
  return <div className={`lifestyle-mosaic ${mosaicClasses[variant]}`} data-localize="off">
    {selected.map(theme => {
      const item = lifestyleMedia[theme]
      return <div key={theme} className={`lifestyle-tile lifestyle-tile--${theme}`}>
        <WellnessPhoto src={item.src} position={item.position} className="absolute inset-0" />
        <span className="lifestyle-tile-caption">{language === "en" ? item.en : item.sv}</span>
      </div>
    })}
  </div>
}
