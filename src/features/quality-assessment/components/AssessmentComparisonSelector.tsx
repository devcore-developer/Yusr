"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Card, CardContent } from "@/components/ui/Card"
import { GitCompare } from "lucide-react"
import { cn } from "@/lib/utils"

interface AssessmentComparisonSelectorProps {
  assessments: any[]
}

export function AssessmentComparisonSelector({ assessments }: AssessmentComparisonSelectorProps) {
  const [selected, setSelected] = useState<string[]>([])
  const router = useRouter()

  const handleToggle = (id: string) => {
    if (selected.includes(id)) {
      setSelected(selected.filter(s => s !== id))
    } else if (selected.length < 4) {
      setSelected([...selected, id])
    }
  }

  const handleCompare = () => {
    if (selected.length >= 2) {
      router.push(`/quality-assessor/compare?ids=${selected.join(",")}`)
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground-strong flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-secondary" />
            مقارنة التقييمات
          </h3>
          <span className="text-xs text-muted-foreground">
            اختر تقييمين أو أكثر ({selected.length}/4)
          </span>
        </div>
        
        <div className="flex flex-wrap gap-2 mb-3">
          {assessments.map(a => (
            <button
              key={a.id}
              onClick={() => handleToggle(a.id)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium border transition-smooth",
                selected.includes(a.id)
                  ? "bg-secondary text-white border-secondary"
                  : "bg-surface border-border text-muted-foreground hover:bg-surface-muted"
              )}
            >
              {a.assessor?.name} - {a.school?.name}
            </button>
          ))}
        </div>

        {selected.length >= 2 && (
          <Button onClick={handleCompare} size="sm" icon={<GitCompare className="w-4 h-4" />}>
            مقارنة ({selected.length}) تقييمات
          </Button>
        )}
      </CardContent>
    </Card>
  )
}