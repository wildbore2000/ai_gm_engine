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
