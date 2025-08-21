import React from 'react'

export const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => {
  const style: React.CSSProperties = {
    background: 'var(--card)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    padding: '8px 10px',
    borderRadius: 8,
    minHeight: 320,
    width: '100%'
  }
  return <textarea {...props} style={{ ...style, ...(props.style||{}) }} />
}
