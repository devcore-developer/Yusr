"use client"
import * as React from "react"
import { cn } from "@/lib/utils"

interface AvatarProps {
  name: string
  src?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

function stringToHue(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360
  return h
}

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const [err, setErr] = React.useState(false)
  const hue = stringToHue(name)
  const fallback = (
    <div
      className={cn("flex items-center justify-center font-semibold text-white rounded-full", sizeMap[size], className)}
      style={{ background: `hsl(${hue} 45% 45%)` }}
    >
      {getInitials(name)}
    </div>
  )

  if (!src || err) return fallback

  return (
    <img
      src={src}
      alt={name}
      onError={() => setErr(true)}
      className={cn("rounded-full object-cover", sizeMap[size], className)}
    />
  )
}