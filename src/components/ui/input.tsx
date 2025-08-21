import React from 'react'

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => {
  const style: React.CSSProperties = {
    background: 'var(--card)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    padding: '8px 10px',
    borderRadius: 8
  }
  return <input {...props} style={{ ...style, ...(props.style||{}) }} />
}
