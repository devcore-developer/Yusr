"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { globalSearch } from "@/features/search/actions"
import { Search, Loader2 } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

export function GlobalSearch() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)

  // Debounce search
  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      setIsOpen(false)
      return
    }
    setLoading(true)
    const timer = setTimeout(async () => {
      const res = await globalSearch(query)
      setResults(res)
      setIsOpen(true)
      setLoading(false)
      setActiveIndex(-1)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex(prev => Math.min(prev + 1, results.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (activeIndex >= 0 && results[activeIndex]) {
        router.push(results[activeIndex].href)
        setIsOpen(false)
        setQuery("")
      }
    } else if (e.key === "Escape") {
      setIsOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative hidden md:block w-[280px] lg:w-[320px]">
      <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => results.length > 0 && setIsOpen(true)}
        placeholder="بحث سريع..."
        className="h-9 w-full pr-10 pl-4 rounded-md border border-border bg-surface-muted text-[13px] text-foreground placeholder:text-muted-foreground/80 focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary/50 focus:bg-surface transition-smooth"
      />
      
      {isOpen && (
        <div className="absolute top-full mt-2 w-full bg-surface border border-border rounded-md shadow-lg z-50 overflow-hidden">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> جاري البحث...
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">لا توجد نتائج مطابقة.</div>
          ) : (
            <ul className="max-h-80 overflow-y-auto scrollbar-thin">
              {results.map((res, i) => (
                <li key={i}>
                  <Link
                    href={res.href}
                    onClick={() => { setQuery(""); setIsOpen(false) }}
                    className={cn(
                      "flex items-center justify-between p-3 hover:bg-surface-muted transition-smooth border-b border-border/50 last:border-0",
                      i === activeIndex && "bg-surface-muted"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground-strong truncate">{res.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{res.sublabel}</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 bg-primary/5 text-primary rounded-full shrink-0 mr-2">{res.type}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}