import * as React from 'react'
import { cn } from '@/lib/utils'
import type { ProfileIcon } from './types'

export interface StatStripItem {
  label: string
  value: React.ReactNode
  icon?: ProfileIcon
  /** Paints the value with the brand color (e.g. an upcoming appointment). */
  highlight?: boolean
}

export interface StatStripProps extends React.ComponentProps<'dl'> {
  items: StatStripItem[]
}

/**
 * One card with N equal cells split by dividers — a compact replacement for a
 * row of stat tiles. Semantically a description list (label `dt`, value `dd`);
 * the value is shown above the label.
 */
export function StatStrip({ items, className, ...props }: StatStripProps) {
  return (
    <dl
      data-slot='stat-strip'
      style={{ gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))` }}
      className={cn('bg-card/60 grid divide-x overflow-hidden rounded-2xl border', className)}
      {...props}
    >
      {items.map(({ label, value, icon: Icon, highlight }) => (
        <div
          key={label}
          className='flex min-w-0 flex-col-reverse items-center gap-0.5 px-2 py-3 text-center sm:py-4'
        >
          <dt className='text-muted-foreground w-full truncate text-[11px] sm:text-xs'>{label}</dt>
          <dd
            className={cn(
              'w-full truncate text-lg font-bold tabular-nums sm:text-2xl',
              highlight && 'text-primary'
            )}
            title={typeof value === 'string' || typeof value === 'number' ? String(value) : undefined}
          >
            {Icon && (
              <Icon
                className={cn('mx-auto mb-0.5 size-4', highlight ? 'text-primary' : 'text-muted-foreground')}
              />
            )}
            {value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
