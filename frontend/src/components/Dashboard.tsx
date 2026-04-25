"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, File, Image as ImageIcon, LockKeyhole, LogOut, Download, ShieldCheck } from "lucide-react";
import { hashFile, encryptFile } from "@/utils/crypto";
import { embedWatermark } from "@/utils/watermark";

interface DashboardProps {
  onLock: () => void;
  cryptoKey: CryptoKey;
  alias: string;
}

interface VaultFile {
  id: string;
  name: string;
  type: string;
  size: string;
  date: string;
}

// Mock initial files
const initialFiles: VaultFile[] = [
  { id: "1", name: "logo_concept_v2.png", type: "image", size: "2.4 MB", date: "Oct 24, 2026" },
  { id: "2", name: "client_contract_signed.pdf", type: "document", size: "840 KB", date: "Oct 22, 2026" },
  { id: "3", name: "album_cover_final.jpg", type: "image", size: "5.1 MB", date: "Oct 20, 2026" },
];

export default function Dashboard({ onLock, cryptoKey, alias }: DashboardProps) {
  const [files, setFiles] = useState<VaultFile[]>(initialFiles);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = async (newFiles: File[]) => {
    setIsProcessing(true);
    
    try {
      const uploadedFiles: VaultFile[] = [];

      for (const file of newFiles) {
        // 1. Watermark (if image)
        const watermarkedFile = await embedWatermark(file, alias);
        
        // 2. Hash for Proof of Creation
        const fingerprint = await hashFile(watermarkedFile);
        console.log(`[Hash for ${file.name}]:`, fingerprint);

        // 3. Encrypt (AES-GCM)
        const { encryptedBlob, iv } = await encryptFile(watermarkedFile, cryptoKey);
        console.log(`[Encrypted Size]:`, encryptedBlob.size, "bytes");

        // Here you would normally POST the encryptedBlob + IV + Hash to the backend!
        // e.g. await fetch('/api/upload', { method: 'POST', body: ... })

        // Mocking the successful local state update
        uploadedFiles.push({
          id: Math.random().toString(),
          name: file.name + ".encrypted",
          type: file.type.includes("image") ? "image" : "document",
          size: (encryptedBlob.size / (1024 * 1024)).toFixed(2) + " MB",
          date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        });
      }
      
      setFiles((prev) => [...uploadedFiles, ...prev]);
    } catch (e) {
      console.error("Encryption failed", e);
      alert("Failed to encrypt file!");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/50 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <LockKeyhole className="text-indigo-400" />
          <h1 className="text-xl font-bold tracking-tight">CreatorVault</h1>
        </div>
        <button
          onClick={onLock}
          className="flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white"
        >
          <LogOut size={16} />
          Lock Vault
        </button>
      </header>

      <main className="mx-auto max-w-6xl p-6">
        {/* Drag and Drop Zone */}
        <section className="mb-10">
          <div
            className={`relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 transition-all ${
              isDragging
                ? "border-indigo-500 bg-indigo-500/10"
                : "border-zinc-700 bg-zinc-900/30 hover:border-zinc-500 hover:bg-zinc-800/50"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInput}
              className="hidden"
              multiple
            />
            {isProcessing ? (
              <div className="flex flex-col items-center animate-pulse">
                <div className="mb-4 rounded-full bg-indigo-500/20 p-4 text-indigo-400">
                  <ShieldCheck className="h-8 w-8" />
                </div>
                <h2 className="mb-2 text-lg font-semibold text-white">Encrypting Files...</h2>
                <p className="text-sm text-indigo-300">Applying AES-256-GCM & Watermark</p>
              </div>
            ) : (
              <>
                <div className="mb-4 rounded-full bg-zinc-800 p-4">
                  <UploadCloud className={`h-8 w-8 ${isDragging ? "text-indigo-400" : "text-zinc-400"}`} />
                </div>
                <h2 className="mb-2 text-lg font-semibold text-white">Upload to Vault</h2>
                <p className="text-sm text-zinc-400 text-center max-w-md">
                  Drag and drop your files here, or click to browse. Files will be 
                  watermarked and encrypted before leaving your browser.
                </p>
              </>
            )}
          </div>
        </section>

        {/* File Explorer */}
        <section>
          <h2 className="mb-6 text-xl font-semibold text-white">Your Encrypted Files</h2>
          
          {files.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-12 text-center text-zinc-500">
              No files in your vault yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="group relative flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition-all hover:border-zinc-600 hover:shadow-lg"
                >
                  <div className="mb-4 flex flex-1 items-center justify-center rounded-lg bg-zinc-800/50 p-6">
                    {file.type === "image" ? (
                      <ImageIcon className="h-12 w-12 text-indigo-400/80" />
                    ) : (
                      <File className="h-12 w-12 text-emerald-400/80" />
                    )}
                  </div>
                  
                  <div className="mt-auto">
                    <p className="truncate text-sm font-medium text-zinc-200" title={file.name}>
                      {file.name}
                    </p>
                    <div className="mt-1 flex items-center justify-between text-xs text-zinc-500">
                      <span>{file.size}</span>
                      <span>{file.date}</span>
                    </div>
                  </div>

                  {/* Hover Actions */}
                  <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                    <button className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
                      <Download size={16} />
                      Export
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
