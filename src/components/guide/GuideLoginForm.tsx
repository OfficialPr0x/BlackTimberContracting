"use client";

import { useState } from "react";
import { BookOpen, Loader, Lock } from "lucide-react";

export default function GuideLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/guide/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error?.message ?? "Login failed");
      }
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-gold/10 border border-brand-gold/25 text-brand-gold">
          <BookOpen className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-extrabold uppercase tracking-tight text-white">
          Field Guide Access
        </h1>
        <p className="text-xs text-brand-gray leading-relaxed">
          Enter the email you signed up with and the access password we sent you.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 bg-brand-charcoal border border-brand-border rounded-2xl p-6">
        <label className="block space-y-1">
          <span className="text-[10px] font-mono uppercase text-brand-gray">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-brand-black border border-brand-border focus:border-brand-gold focus:outline-none rounded-lg px-3 py-2.5 text-sm text-white"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[10px] font-mono uppercase text-brand-gray">Password</span>
          <input
            type="text"
            required
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="KTN-XXXX-XXXX"
            className="w-full bg-brand-black border border-brand-border focus:border-brand-gold focus:outline-none rounded-lg px-3 py-2.5 text-sm text-white font-mono tracking-wider"
          />
        </label>
        {error ? <p className="text-xs text-red-400">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="w-full py-3 bg-brand-gold hover:bg-brand-gold-hover disabled:opacity-60 text-brand-black font-bold uppercase tracking-widest text-xs rounded-xl flex items-center justify-center gap-2"
        >
          {pending ? <Loader className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
          Unlock Field Guide
        </button>
      </form>
    </div>
  );
}
