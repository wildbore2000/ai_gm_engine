import React from 'react'

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, style, ...props }) => {
  const base: React.CSSProperties = {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 12,
  }
  return <div {...props} style={{ ...base, ...style }}>{children}</div>
}

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, style, ...props }) => {
  const base: React.CSSProperties = {
    padding: 16
  }
  return <div {...props} style={{ ...base, ...style }}>{children}</div>
}

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, style, ...props }) => {
  const base: React.CSSProperties = {
    padding: '16px 16px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: 8
  }
  return <div {...props} style={{ ...base, ...style }}>{children}</div>
}

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ children, style, ...props }) => {
  const base: React.CSSProperties = {
    fontSize: '1.25rem',
    fontWeight: 600,
    lineHeight: 1.25,
    margin: 0
  }
  return <h3 {...props} style={{ ...base, ...style }}>{children}</h3>
}
