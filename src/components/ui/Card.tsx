import * as React from "react"
import { cn } from "@/lib/utils"

type CardVariant = 'primary' | 'secondary' | 'insight' | 'flat'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  as?: React.ElementType
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'primary', ...props }, ref) => {
    const variants: Record<CardVariant, string> = {
      primary:   "bg-surface border border-border/80 rounded-lg shadow-premium",
      secondary: "bg-surface border border-border rounded-lg",
      insight:   "rounded-lg border border-border/60 bg-surface-muted",
      flat:      "bg-transparent",
    }
    return <div ref={ref} className={cn(variants[variant], className)} {...props} />
  }
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { divided?: boolean }>(
  ({ className, divided = true, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col p-5 lg:p-6", divided && "border-b border-border", className)}
      {...props}
    />
  )
)
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement> & { icon?: React.ReactNode }>(
  ({ className, icon, children, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("text-card-title text-foreground-strong flex items-center gap-2", className)}
      {...props}
    >
      {icon && <span className="text-muted-foreground [&>svg]:w-[1.125em] [&>svg]:h-[1.125em]">{icon}</span>}
      {children}
    </h3>
  )
)
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-[13px] text-muted-foreground mt-1", className)} {...props} />
  )
)
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-5 lg:p-6", className)} {...props} />
  )
)
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-5 lg:p-6 border-t border-border", className)} {...props} />
  )
)
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }