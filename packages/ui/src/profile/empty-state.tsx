import * as React from 'react'
import { cn } from '@/lib/utils'
import type { ProfileIcon } from './types'

export interface EmptyStateProps extends Omit<React.ComponentProps<'div'>, 'title'> {
  icon?: ProfileIcon
  title: React.ReactNode
  description?: React.ReactNode
  /** Primary way out of the empty state (e.g. a "Create" button). */
  action?: React.ReactNode
}

/** Quiet empty placeholder for lists and sections. */
export function EmptyState({ icon: Icon, title, description, action, className, ...props }: EmptyStateProps) {
  return (
    <div
      data-slot='empty-state'
      className={cn(
        'text-muted-foreground flex flex-col items-center justify-center gap-2 py-8 text-center',
        className
      )}
      {...props}
    >
      {Icon && <Icon className='size-6 opacity-50' />}
      <p className='text-sm'>{title}</p>
      {description && <p className='text-xs'>{description}</p>}
      {action}
    </div>
  )
}
