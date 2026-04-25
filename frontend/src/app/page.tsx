"use client";

import { useState } from "react";
import LoginScreen from "@/components/LoginScreen";
import Dashboard from "@/components/Dashboard";
import { deriveKey } from "@/utils/crypto";

export default function Home() {
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const [alias, setAlias] = useState<string>("");
  const [isUnlocking, setIsUnlocking] = useState(false);

  const handleUnlock = async (password: string, userAlias: string) => {
    setIsUnlocking(true);
    try {
      const key = await deriveKey(password);
      setCryptoKey(key);
      setAlias(userAlias);
    } catch (error) {
      console.error("Failed to unlock", error);
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleLock = () => {
    // Wipe the derived key from memory
    setCryptoKey(null);
    setAlias("");
  };

  return (
    <main>
      {!cryptoKey ? (
        <div className="relative">
          {isUnlocking && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm text-indigo-400">
              Deriving Key (PBKDF2)...
            </div>
          )}
          <LoginScreen onUnlock={handleUnlock} />
        </div>
      ) : (
        <Dashboard onLock={handleLock} cryptoKey={cryptoKey} alias={alias} />
      )}
    </main>
  );
}
