import * as React from 'react'
import { cn } from '@/lib/utils'

export interface DefinitionItem {
  label: string
  value?: React.ReactNode
}

export interface DefinitionListProps extends React.ComponentProps<'dl'> {
  items: DefinitionItem[]
  /** Shown (muted) when a value is empty. */
  emptyLabel?: string
}

/**
 * Label/value rows split by dividers: stacked on phones, label left and value
 * right from `sm`. Long values wrap instead of overflowing.
 */
export function DefinitionList({
  items,
  emptyLabel = 'No registrado',
  className,
  ...props
}: DefinitionListProps) {
  return (
    <dl data-slot='definition-list' className={cn('divide-y', className)} {...props}>
      {items.map(({ label, value }) => {
        const empty = value === undefined || value === null || value === ''
        return (
          <div
            key={label}
            className='flex flex-col gap-0.5 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6'
          >
            <dt className='text-muted-foreground text-sm'>{label}</dt>
            <dd
              className={cn(
                'min-w-0 font-medium break-words sm:text-right',
                empty && 'text-muted-foreground font-normal'
              )}
            >
              {empty ? emptyLabel : value}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
