import * as React from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../primitives/card'
import type { ProfileIcon } from './types'

export interface SectionCardProps extends Omit<React.ComponentProps<typeof Card>, 'title'> {
  icon?: ProfileIcon
  title: React.ReactNode
  description?: React.ReactNode
  /** Chips shown next to the title (counts, state). */
  badges?: React.ReactNode
  /** Trailing header slot: "See all" link, edit button… */
  action?: React.ReactNode
  contentClassName?: string
}

/**
 * Single-level card with an icon title. Its body is meant to hold rows
 * separated by dividers (`DefinitionList`, `RecordList`) rather than nested
 * boxes, and it is tighter on phones (16px gutters) than the stock `Card`.
 */
export function SectionCard({
  icon: Icon,
  title,
  description,
  badges,
  action,
  className,
  contentClassName,
  children,
  ...props
}: SectionCardProps) {
  return (
    <Card
      data-slot='section-card'
      className={cn('gap-2 py-4 shadow-none sm:gap-3 sm:py-5', className)}
      {...props}
    >
      <CardHeader className='flex flex-row items-start justify-between gap-2 px-4 sm:px-5'>
        <div className='min-w-0 space-y-1'>
          <CardTitle className='flex flex-wrap items-center gap-x-2 gap-y-1 text-base'>
            {Icon && <Icon className='text-primary size-5 shrink-0' />}
            <span className='min-w-0 break-words'>{title}</span>
            {badges && <span className='flex flex-wrap items-center gap-1.5'>{badges}</span>}
          </CardTitle>
          {description && (
            <CardDescription className='break-words'>{description}</CardDescription>
          )}
        </div>
        {action}
      </CardHeader>
      <CardContent className={cn('px-4 sm:px-5', contentClassName)}>{children}</CardContent>
    </Card>
  )
}
