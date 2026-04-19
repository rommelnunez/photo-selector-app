"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Gallery {
  id: string;
  name: string;
  slug: string;
  status: string;
  cover_url: string | null;
  photo_count: number;
  created_at: string;
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);

  const loadGalleries = useCallback(async () => {
    const res = await fetch("/api/admin/galleries");
    if (res.ok) {
      const data = await res.json();
      setGalleries(data);
      setAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    // Check if already authenticated
    loadGalleries();
  }, [loadGalleries]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setAuthenticated(true);
      loadGalleries();
    } else {
      setError("Invalid password");
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    const res = await fetch("/api/admin/galleries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, slug: newSlug, password: newPassword }),
    });
    if (res.ok) {
      setNewName("");
      setNewSlug("");
      setNewPassword("");
      setShowCreate(false);
      loadGalleries();
    }
    setCreating(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}" and all its photos?`)) return;
    await fetch(`/api/admin/galleries/${id}`, { method: "DELETE" });
    loadGalleries();
  };

  const copyUrl = (slug: string) => {
    const url = `${window.location.origin}/gallery/${slug}`;
    navigator.clipboard.writeText(url);
  };

  if (!authenticated) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="w-full max-w-xs space-y-4">
          <h1 className="text-xl font-bold text-center">Admin</h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full border border-border px-4 py-3 focus:outline-none focus:border-black"
            autoFocus
          />
          <button
            type="submit"
            className="w-full bg-black text-white py-3 font-medium cursor-pointer hover:bg-black/80"
          >
            Enter
          </button>
          {error && <p className="text-text-secondary text-sm text-center">{error}</p>}
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-bold tracking-tight">GALLERIES</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-black text-white px-4 py-2 text-sm font-medium cursor-pointer hover:bg-black/80"
        >
          + New Gallery
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="border border-border p-4 mb-8 space-y-3">
          <input
            type="text"
            placeholder="Gallery name"
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
            }}
            className="w-full border border-border px-3 py-2 focus:outline-none focus:border-black"
          />
          <input
            type="text"
            placeholder="Slug (URL path)"
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value)}
            className="w-full border border-border px-3 py-2 text-text-secondary focus:outline-none focus:border-black"
          />
          <input
            type="text"
            placeholder="Client password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full border border-border px-3 py-2 focus:outline-none focus:border-black"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating || !newName || !newSlug || !newPassword}
              className="bg-black text-white px-4 py-2 text-sm font-medium cursor-pointer disabled:opacity-40 hover:bg-black/80"
            >
              {creating ? "Creating..." : "Create"}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="border border-border px-4 py-2 text-sm cursor-pointer hover:bg-bg-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="divide-y divide-border">
        {galleries.map((g) => (
          <div key={g.id} className="py-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-bold">{g.name}</h2>
                <p className="text-sm text-text-secondary mt-0.5">
                  {g.photo_count} photos &middot;{" "}
                  <span className="capitalize">{g.status}</span>
                </p>
                <p className="text-sm text-text-secondary mt-0.5">
                  /gallery/{g.slug}
                </p>
              </div>
              <div className="flex gap-3 text-sm">
                <button
                  onClick={() => copyUrl(g.slug)}
                  className="text-text-secondary hover:text-black cursor-pointer"
                >
                  Copy
                </button>
                <Link
                  href={`/admin/gallery/${g.id}`}
                  className="text-text-secondary hover:text-black"
                >
                  View
                </Link>
                <button
                  onClick={() => handleDelete(g.id, g.name)}
                  className="text-text-secondary hover:text-black cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}

        {galleries.length === 0 && (
          <p className="text-text-secondary py-8 text-center">No galleries yet</p>
        )}
      </div>
    </div>
  );
}
