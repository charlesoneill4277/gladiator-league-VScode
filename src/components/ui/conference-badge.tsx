import React from 'react';
import { Badge } from '@/components/ui/badge';
import { getConferenceBadgeClasses } from '@/utils/conferenceColors';

interface ConferenceBadgeProps {
  conferenceName: string;
  variant?: 'default' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ConferenceBadge: React.FC<ConferenceBadgeProps> = ({
  conferenceName,
  variant = 'secondary',
  size = 'md',
  className = ''
}) => {
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-xs px-2 py-1',
    lg: 'text-sm px-2.5 py-1.5'
  };

  const conferenceClasses = getConferenceBadgeClasses(conferenceName);
  
  return (
    <Badge 
      variant={variant}
      className={`${sizeClasses[size]} ${conferenceClasses} ${className}`}
    >
      {conferenceName}
    </Badge>
  );
};

export default ConferenceBadge;