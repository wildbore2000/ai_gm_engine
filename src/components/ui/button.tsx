import React from 'react'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' }

export const Button: React.FC<Props> = ({ variant='primary', style, ...props }) => {
  const base: React.CSSProperties = {
    background: variant === 'primary' ? 'var(--accent)' : 'transparent',
    color: variant === 'primary' ? 'white' : 'var(--text)',
    border: '1px solid var(--border)',
    padding: '8px 12px',
    borderRadius: 10,
    cursor: 'pointer'
  }
  return <button {...props} style={{ ...base, ...style }} />
}
