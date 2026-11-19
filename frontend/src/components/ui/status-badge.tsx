import type { ComponentProps } from 'react'
import { CheckCircle2, Circle, CircleAlert, TriangleAlert } from 'lucide-react'
import { Badge } from './badge'

const statusIcons = {
  neutral: Circle,
  success: CheckCircle2,
  warning: TriangleAlert,
  destructive: CircleAlert,
}

interface StatusBadgeProps extends Omit<ComponentProps<typeof Badge>, 'children' | 'variant'> {
  tone?: keyof typeof statusIcons
  children: string
}

export function StatusBadge({ tone = 'neutral', children, ...props }: StatusBadgeProps) {
  const Icon = statusIcons[tone]
  return (
    <Badge variant={tone === 'destructive' ? 'destructive' : 'secondary'} {...props}>
      <Icon aria-hidden="true" />
      {children}
    </Badge>
  )
}
