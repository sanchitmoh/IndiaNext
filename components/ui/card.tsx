import * as React from 'react';

type CardProps = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className = '', ...props }: CardProps) {
  return (
    <div
      className={`rounded-lg border bg-card text-card-foreground shadow-sm ${className}`}
      {...props}
    />
  );
}

type CardHeaderProps = React.HTMLAttributes<HTMLDivElement>;

export function CardHeader({ className = '', ...props }: CardHeaderProps) {
  return <div className={`flex flex-col space-y-1.5 p-6 ${className}`} {...props} />;
}

type CardTitleProps = React.HTMLAttributes<HTMLHeadingElement>;

export function CardTitle({ className = '', ...props }: CardTitleProps) {
  return <h3 className={`text-2xl font-semibold leading-none tracking-tight ${className}`} {...props} />;
}

type CardDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>;

export function CardDescription({ className = '', ...props }: CardDescriptionProps) {
  return <p className={`text-sm text-muted-foreground ${className}`} {...props} />;
}

type CardContentProps = React.HTMLAttributes<HTMLDivElement>;

export function CardContent({ className = '', ...props }: CardContentProps) {
  return <div className={`p-6 pt-0 ${className}`} {...props} />;
}

type CardFooterProps = React.HTMLAttributes<HTMLDivElement>;

export function CardFooter({ className = '', ...props }: CardFooterProps) {
  return <div className={`flex items-center p-6 pt-0 ${className}`} {...props} />;
}
