import * as React from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

interface DrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

export function Drawer({ open, onOpenChange, children }: DrawerProps) {
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 transition-opacity"
        onClick={() => onOpenChange(false)}
      />
      {/* Drawer */}
      <div className="fixed inset-x-0 bottom-0 z-50">
        {children}
      </div>
    </>
  )
}

export function DrawerContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bg-white rounded-t-[10px] shadow-lg",
        "max-h-[85vh] overflow-auto",
        "animate-in slide-in-from-bottom duration-300",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function DrawerHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function DrawerTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("text-lg font-semibold", className)}
      {...props}
    />
  )
}

export function DrawerClose({
  className,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        "disabled:pointer-events-none",
        className
      )}
      onClick={onClick}
      {...props}
    >
      <X className="h-4 w-4" />
      <span className="sr-only">Close</span>
    </button>
  )
}

export function DrawerBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("p-4", className)} {...props} />
  )
}
