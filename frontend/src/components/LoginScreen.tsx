"use client";

import React, { useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";

interface LoginScreenProps {
  onUnlock: (password: string, alias: string) => void;
}

export default function LoginScreen({ onUnlock }: LoginScreenProps) {
  const [password, setPassword] = useState("");
  const [alias, setAlias] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim() !== "" && alias.trim() !== "") {
      onUnlock(password, alias);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 shadow-2xl backdrop-blur-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400">
            <ShieldCheck size={32} />
          </div>
          <h1 className="mb-2 text-2xl font-bold tracking-tight text-white">CreatorVault</h1>
          <p className="text-sm text-zinc-400">Enter your Master Password to unlock your secure workspace.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Lock className="h-5 w-5 text-zinc-500" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-lg border border-zinc-700 bg-zinc-800/50 p-3 pl-10 text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                placeholder="Master Password"
                required
              />
            </div>

            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <span className="text-zinc-500 font-bold px-1">@</span>
              </div>
              <input
                type="text"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                className="block w-full rounded-lg border border-zinc-700 bg-zinc-800/50 p-3 pl-10 text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                placeholder="Creator Alias (for Watermarking)"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="flex w-full justify-center rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 focus:ring-offset-zinc-900"
          >
            Unlock Vault
          </button>
        </form>
        
        <p className="mt-6 text-center text-xs text-zinc-500">
          Everything is encrypted locally. We cannot recover your password if lost.
        </p>
      </div>
    </div>
  );
}
