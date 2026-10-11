import { domainScores } from "@/data/mock-quality"
import { Progress } from "@/components/ui/Progress"

export function DomainScoreChart() {
  return (
    <div className="space-y-5 mt-4">
      {domainScores.map((domain) => (
        <div key={domain.domainId}>
          <div className="flex justify-between mb-1.5">
            <span className="text-sm font-medium text-foreground">{domain.label}</span>
            <span className="text-sm font-bold text-secondary">{domain.score}%</span>
          </div>
          <Progress 
            value={domain.score} 
            className="h-2.5" 
            indicatorClassName={domain.score >= 80 ? "bg-success" : domain.score >= 60 ? "bg-warning" : "bg-danger"}
          />
        </div>
      ))}
    </div>
  )
}