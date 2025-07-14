import React from 'react';
import { cn } from '@/lib/utils';

interface TimelineProps {
  children: React.ReactNode;
  className?: string;
}

const Timeline: React.FC<TimelineProps> = ({ children, className }) => {
  return (
    <div className={cn("relative", className)}>
      {children}
    </div>
  );
};

interface TimelineItemProps {
  children: React.ReactNode;
  className?: string;
}

const TimelineItem: React.FC<TimelineItemProps> = ({ children, className }) => {
  return (
    <div className={cn("relative pb-8 last:pb-0", className)}>
      {children}
    </div>
  );
};

interface TimelineConnectorProps {
  className?: string;
}

const TimelineConnector: React.FC<TimelineConnectorProps> = ({ className }) => {
  return (
    <div className={cn("absolute left-4 top-8 h-full w-0.5 bg-gray-200", className)} />
  );
};

interface TimelineIconProps {
  children: React.ReactNode;
  className?: string;
}

const TimelineIcon: React.FC<TimelineIconProps> = ({ children, className }) => {
  return (
    <div className={cn("absolute left-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white", className)}>
      {children}
    </div>
  );
};

interface TimelineContentProps {
  children: React.ReactNode;
  className?: string;
}

const TimelineContent: React.FC<TimelineContentProps> = ({ children, className }) => {
  return (
    <div className={cn("ml-10", className)}>
      {children}
    </div>
  );
};

interface TimelineTitleProps {
  children: React.ReactNode;
  className?: string;
}

const TimelineTitle: React.FC<TimelineTitleProps> = ({ children, className }) => {
  return (
    <h3 className={cn("text-lg font-semibold", className)}>
      {children}
    </h3>
  );
};

interface TimelineDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

const TimelineDescription: React.FC<TimelineDescriptionProps> = ({ children, className }) => {
  return (
    <p className={cn("text-sm text-gray-600", className)}>
      {children}
    </p>
  );
};

interface TimelineTimeProps {
  children: React.ReactNode;
  className?: string;
}

const TimelineTime: React.FC<TimelineTimeProps> = ({ children, className }) => {
  return (
    <time className={cn("text-xs text-gray-500", className)}>
      {children}
    </time>
  );
};

export {
  Timeline,
  TimelineItem,
  TimelineConnector,
  TimelineIcon,
  TimelineContent,
  TimelineTitle,
  TimelineDescription,
  TimelineTime
};
