import Image from "next/image"
import { cn } from "@/lib/utils"

/** Responsive decorative lifestyle photo; nearby text supplies the section meaning. */
export function WellnessPhoto({ src, className = "", priority = false, position = "50% 50%" }: { src: string; className?: string; priority?: boolean; position?: string }) {
  return <div className={cn("wellness-photo relative overflow-hidden", className)}>
    {/* These local WebP assets are already optimized; serve them directly. */}
    <Image src={src} alt="" fill unoptimized
      sizes="(min-width: 1024px) 480px, (min-width: 768px) 50vw, 100vw"
      className="object-cover" style={{ objectPosition: position }} priority={priority} />
  </div>
}
