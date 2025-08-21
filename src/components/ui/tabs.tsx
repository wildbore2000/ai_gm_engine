import React from 'react'

type TabsProps = { defaultValue: string, children: React.ReactNode, className?: string }
type TabsContext = { value: string, setValue: (v: string) => void }
const Ctx = React.createContext<TabsContext | null>(null)

export const Tabs: React.FC<TabsProps> = ({ defaultValue, children }) => {
  const [value, setValue] = React.useState(defaultValue)
  return <Ctx.Provider value={{ value, setValue }}>{children}</Ctx.Provider>
}

export const TabsList: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, style, ...props }) => {
  const base: React.CSSProperties = { display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 8, marginBottom: 12 }
  return <div {...props} style={{ ...base, ...style }}>{children}</div>
}

export const TabsTrigger: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }> = ({ value, children }) => {
  const ctx = React.useContext(Ctx)!
  const active = ctx.value === value
  return <button onClick={() => ctx.setValue(value)} style={{ padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', background: active ? 'var(--accent)' : 'transparent', color: active ? 'white' : 'var(--text)', cursor:'pointer' }}>{children}</button>
}

export const TabsContent: React.FC<{ value: string, children: React.ReactNode }> = ({ value, children }) => {
  const ctx = React.useContext(Ctx)!
  if (ctx.value !== value) return null
  return <div>{children}</div>
}
