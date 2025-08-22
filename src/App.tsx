import React, { useState } from "react";
import { useAuth } from "./context/AuthContext";
import Login from "./components/Login";
import EngineEditor from "./components/EngineEditor";
import GameScreen from "./pages/GameScreen";
import { supabase } from "./lib/supabase";
import { Play, Settings } from "lucide-react";

export default function App() {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState<'editor' | 'game'>('editor');
  
  if (loading) return <div className="p-6 text-slate-200">Loading…</div>;
  if (!user) return <Login />;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between p-3 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <div className="font-semibold">AI GM Engine</div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentView('editor')}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-1 transition-colors ${
                currentView === 'editor' 
                  ? 'bg-slate-700 text-slate-100' 
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              <Settings className="w-4 h-4" /> Editor
            </button>
            <button
              onClick={() => setCurrentView('game')}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-1 transition-colors ${
                currentView === 'game' 
                  ? 'bg-slate-700 text-slate-100' 
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              <Play className="w-4 h-4" /> Play
            </button>
          </div>
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          className="rounded-lg px-3 py-1 bg-slate-800 hover:bg-slate-700 transition-colors"
        >Sign out</button>
      </header>
      {currentView === 'editor' ? <EngineEditor /> : <GameScreen />}
    </div>
  );
}
