import { cn } from '@/lib/utils/cn'
import { getInitials } from '@/lib/utils/formatters'

interface AvatarProps {
  name: string
  color?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  imageUrl?: string | null
  className?: string
}

const SIZES = {
  sm: 'w-7 h-7 text-[10px]',
  md: 'w-9 h-9 text-[12px]',
  lg: 'w-11 h-11 text-[14px]',
  xl: 'w-14 h-14 text-[18px]',
}

export function Avatar({ name, color = '#6366f1', size = 'md', imageUrl, className }: AvatarProps) {
  const initials = getInitials(name)

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={cn('rounded-full object-cover flex-shrink-0', SIZES[size], className)}
      />
    )
  }

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center flex-shrink-0 font-bold text-white',
        SIZES[size],
        className
      )}
      style={{ background: color }}
    >
      {initials}
    </div>
  )
}
