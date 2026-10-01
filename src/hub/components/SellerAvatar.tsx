import { User } from 'lucide-react';

interface SellerAvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  borderColor?: string;
}

const sizeMap = {
  xs: 'w-8 h-8 text-xs',
  sm: 'w-9 h-9 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-16 h-16 text-lg',
  xl: 'w-20 h-20 text-xl',
};

export function SellerAvatar({ name, avatarUrl, size = 'md', className = '', borderColor }: SellerAvatarProps) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const sizeClass = sizeMap[size];

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${sizeClass} rounded-full object-cover border-2 ${borderColor || 'border-primary/30'} shadow-lg shadow-primary/10 flex-shrink-0 ${className}`}
      />
    );
  }

  return (
    <div className={`${sizeClass} rounded-full bg-gradient-to-br from-primary/40 to-secondary/60 flex items-center justify-center font-semibold flex-shrink-0 border-2 ${borderColor || 'border-primary/30'} ${className}`}>
      {initials}
    </div>
  );
}
