import React from 'react'
import EngineEditor from './components/EngineEditor'

export default function App() {
  return (
    <div className="container">
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Engine Editor UI (Prototype)</h1>
      <p className="muted" style={{ marginTop: 0, marginBottom: 16 }}>Edit JSON for Entities, Factions, World, and Arcs with live schema validation.</p>
      <EngineEditor />
    </div>
  )
}
