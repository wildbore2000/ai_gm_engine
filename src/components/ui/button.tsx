import React from 'react'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { 
  variant?: 'primary' | 'secondary' | 'default' | 'outline'; 
  size?: 'default' | 'sm' | 'lg';
}

export const Button: React.FC<Props> = ({ variant='primary', size='default', style, ...props }) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
      case 'default':
        return {
          background: 'var(--accent)',
          color: 'white',
          border: '1px solid var(--accent)'
        };
      case 'outline':
        return {
          background: 'transparent',
          color: 'var(--text)',
          border: '1px solid var(--border)'
        };
      case 'secondary':
        return {
          background: 'var(--muted)',
          color: 'var(--text)',
          border: '1px solid var(--border)'
        };
      default:
        return {
          background: 'var(--accent)',
          color: 'white',
          border: '1px solid var(--accent)'
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return { padding: '4px 8px', fontSize: '0.875rem' };
      case 'lg':
        return { padding: '12px 16px', fontSize: '1.125rem' };
      default:
        return { padding: '8px 12px' };
    }
  };

  const base: React.CSSProperties = {
    ...getVariantStyles(),
    ...getSizeStyles(),
    borderRadius: 10,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  };
  
  return <button {...props} style={{ ...base, ...style }} />
}
