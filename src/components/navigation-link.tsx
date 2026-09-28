"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ComponentProps } from "react"

/** Preserve ordinary links while exposing the current destination visually and to AT. */
export function NavigationLink(props: ComponentProps<typeof Link>) {
  const pathname = usePathname()
  return <Link {...props} aria-current={pathname === props.href ? "page" : undefined} />
}
