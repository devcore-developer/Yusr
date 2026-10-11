import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'soft'
  size?: 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm'
  loading?: boolean
  icon?: React.ReactNode
  iconPosition?: 'start' | 'end'
  href?: string
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, icon, iconPosition = 'start', href, asChild, children, disabled, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center gap-2 font-medium transition-smooth focus-ring disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap"

    const variants = {
      primary:   "bg-primary text-primary-foreground hover:bg-primary-600 shadow-sm",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary-600 shadow-sm",
      outline:   "border border-border bg-surface hover:bg-surface-muted text-foreground-strong",
      ghost:     "hover:bg-surface-muted text-foreground",
      soft:      "bg-secondary/10 text-secondary hover:bg-secondary/15",
      danger:    "bg-danger text-white hover:bg-danger/90 shadow-sm",
      success:   "bg-success text-white hover:bg-success/90 shadow-sm",
    }

    const sizes = {
      'sm':       "h-8 px-3 text-[13px] rounded-md",
      'md':       "h-10 px-4 text-sm rounded-md",
      'lg':       "h-12 px-6 text-base rounded-lg",
      'icon':     "h-10 w-10 rounded-md",
      'icon-sm':  "h-8 w-8 rounded-md",
    }

    const renderIcon = () => {
      if (loading) return <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      if (!icon) return null
      return <span className="shrink-0 w-[1em] h-[1em] inline-flex items-center justify-center [&>svg]:w-[1.125em] [&>svg]:h-[1.125em]">{icon}</span>
    }

    const classes = cn(baseStyles, variants[variant], sizes[size], className)

    const content = (
      <>
        {iconPosition === 'start' && renderIcon()}
        {children}
        {iconPosition === 'end' && renderIcon()}
      </>
    )

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<{ className?: string }>, {
        className: cn(classes, (children.props as { className?: string }).className),
      })
    }

    if (href) {
      return (
        <a href={href} className={classes} onClick={props.onClick as unknown as React.MouseEventHandler<HTMLAnchorElement>}>
          {content}
        </a>
      )
    }

    return (
      <button
        className={classes}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {content}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button }