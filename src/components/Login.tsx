import React, { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSignIn(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setErr(error.message);
    setLoading(false);
  }

  async function onSignUp(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setErr(error.message);
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
      <form onSubmit={onSignIn} className="w-full max-w-sm space-y-4 p-6 rounded-2xl bg-slate-900 shadow-lg">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <input className="w-full rounded-lg p-2 bg-slate-800 border border-slate-700"
               type="email" placeholder="you@domain.com" value={email}
               onChange={(e)=>setEmail(e.target.value)} required />
        <input className="w-full rounded-lg p-2 bg-slate-800 border border-slate-700"
               type="password" placeholder="••••••••" value={password}
               onChange={(e)=>setPassword(e.target.value)} required />
        {err && <div className="text-red-400 text-sm">{err}</div>}
        <div className="flex gap-2">
          <button disabled={loading} className="flex-1 rounded-lg p-2 bg-indigo-600 hover:bg-indigo-500">{loading ? "…" : "Sign in"}</button>
          <button onClick={onSignUp} className="flex-1 rounded-lg p-2 bg-slate-700 hover:bg-slate-600" type="button">Sign up</button>
        </div>
      </form>
    </div>
  );
}