import { cn } from '@/lib/utils'

interface Props {
  children: React.ReactNode
  className?: string
}

export function Card({ children, className }: Props) {
  return (
    <div className={cn('bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-xs transition-all duration-300', className)}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: Props) {
  return (
    <div className={cn('px-6 py-5 border-b border-slate-100/80', className)}>
      {children}
    </div>
  )
}

export function CardBody({ children, className }: Props) {
  return (
    <div className={cn('px-6 py-5', className)}>
      {children}
    </div>
  )
}
