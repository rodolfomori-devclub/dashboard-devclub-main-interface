import { Users } from 'lucide-react';

export function TeamAvatar({
  name,
  imageUrl,
  size = 'md',
  className = '',
  style,
}: {
  name: string;
  imageUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  style?: React.CSSProperties;
}) {
  const sizeMap = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-12 w-12 text-sm',
    lg: 'h-16 w-16 text-base',
    xl: 'h-28 w-28 text-xl',
    '2xl': 'h-40 w-40 text-3xl',
  };
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div
      className={`${sizeMap[size]} ${className} rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 border-2 border-primary/30 flex items-center justify-center overflow-hidden flex-shrink-0`}
      style={style}
    >
      {imageUrl ? (
        <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span className="font-bold text-primary flex items-center gap-1">
          {initials || <Users className="h-4 w-4" />}
        </span>
      )}
    </div>
  );
}
