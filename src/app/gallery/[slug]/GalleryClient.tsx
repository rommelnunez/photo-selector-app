"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import PhotoGrid from "@/components/PhotoGrid";
import PhotoLightbox from "@/components/PhotoLightbox";

interface Photo {
  id: string;
  blob_url: string;
  filename: string;
  position: number;
}

interface SelectionState {
  selected: boolean;
  comment: string;
}

interface GalleryInfo {
  name: string;
  slug: string;
  cover_url: string | null;
}

const STORAGE_KEY = (slug: string) => `selections_${slug}`;

export default function GalleryClient({ gallery }: { gallery: GalleryInfo }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selections, setSelections] = useState<Map<string, SelectionState>>(new Map());
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const selectedCount = Array.from(selections.values()).filter((s) => s.selected).length;

  // Persist selections to localStorage
  const saveToStorage = useCallback(
    (sel: Map<string, SelectionState>) => {
      const obj: Record<string, SelectionState> = {};
      sel.forEach((v, k) => {
        if (v.selected || v.comment) obj[k] = v;
      });
      localStorage.setItem(STORAGE_KEY(gallery.slug), JSON.stringify(obj));
    },
    [gallery.slug]
  );

  // Load photos after auth
  const loadPhotos = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/gallery/${gallery.slug}/photos`);
    if (res.ok) {
      const data = await res.json();
      setPhotos(data.photos);

      // Merge: DB selections first, then localStorage overlay
      const merged = new Map<string, SelectionState>();

      // Load from DB (previous submission)
      if (data.selections && data.selections.length > 0) {
        data.selections.forEach((s: { photo_id: string; comment: string | null }) => {
          merged.set(s.photo_id, { selected: true, comment: s.comment || "" });
        });
      }

      // Load from localStorage (in-progress work)
      try {
        const stored = localStorage.getItem(STORAGE_KEY(gallery.slug));
        if (stored) {
          const obj = JSON.parse(stored) as Record<string, SelectionState>;
          Object.entries(obj).forEach(([k, v]) => {
            merged.set(k, v);
          });
        }
      } catch {
        // ignore
      }

      setSelections(merged);
      setAuthenticated(true);
    }
    setLoading(false);
  }, [gallery.slug]);

  // Try loading photos on mount (might already have cookie)
  useEffect(() => {
    loadPhotos().catch(() => {
      // Not authenticated — will show password gate
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const res = await fetch(`/api/gallery/${gallery.slug}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      loadPhotos();
    } else {
      setError("Invalid password");
    }
  };

  const toggleSelect = useCallback(
    (photoId: string) => {
      setSelections((prev) => {
        const next = new Map(prev);
        const current = next.get(photoId) || { selected: false, comment: "" };
        next.set(photoId, { ...current, selected: !current.selected });
        saveToStorage(next);
        return next;
      });
    },
    [saveToStorage]
  );

  const updateComment = useCallback(
    (photoId: string, comment: string) => {
      setSelections((prev) => {
        const next = new Map(prev);
        const current = next.get(photoId) || { selected: false, comment: "" };
        next.set(photoId, { ...current, comment });
        saveToStorage(next);
        return next;
      });
    },
    [saveToStorage]
  );

  const handleSubmit = async () => {
    setSubmitting(true);
    const selected = Array.from(selections.entries())
      .filter(([, v]) => v.selected)
      .map(([photoId, v]) => ({
        photoId,
        comment: v.comment || undefined,
      }));

    const res = await fetch(`/api/gallery/${gallery.slug}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selections: selected }),
    });

    if (res.ok) {
      localStorage.removeItem(STORAGE_KEY(gallery.slug));
      setSubmitted(true);
    }
    setSubmitting(false);
  };

  // Password gate
  if (!authenticated) {
    return (
      <div className="flex-1 flex items-center justify-center relative">
        {/* Cover image background */}
        {gallery.cover_url && (
          <div className="absolute inset-0">
            <Image
              src={gallery.cover_url}
              alt=""
              fill
              className="object-cover blur-xl opacity-30"
              priority
            />
          </div>
        )}

        <form
          onSubmit={handleLogin}
          className="relative z-10 bg-white p-8 sm:p-10 w-full max-w-sm mx-4 space-y-4 border border-border"
        >
          <div className="text-center">
            <h1 className="text-lg font-bold tracking-tight">{gallery.name}</h1>
            <p className="text-sm text-text-secondary mt-1">Enter password</p>
          </div>
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

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-text-secondary">Loading...</p>
      </div>
    );
  }

  // Submitted confirmation
  if (submitted) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <h1 className="text-xl font-bold">Selections Submitted</h1>
          <p className="text-text-secondary">
            {selectedCount} photo{selectedCount !== 1 ? "s" : ""} selected. Thank you!
          </p>
          <button
            onClick={() => setSubmitted(false)}
            className="text-sm text-text-secondary underline cursor-pointer"
          >
            Review or change selections
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <h1 className="text-lg font-bold tracking-tight">{gallery.name}</h1>
      </div>

      {/* Photo grid */}
      <div className="flex-1 p-1 sm:p-2 pb-20">
        <PhotoGrid
          photos={photos}
          selections={selections}
          onToggleSelect={toggleSelect}
          onOpenPhoto={setLightboxIndex}
        />
      </div>

      {/* Sticky bottom bar */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-border px-4 py-3 flex items-center justify-between z-40"
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      >
        <span className="text-sm font-medium">
          {selectedCount} selected
        </span>
        <button
          onClick={handleSubmit}
          disabled={submitting || selectedCount === 0}
          className="bg-black text-white px-6 py-2.5 text-sm font-medium cursor-pointer disabled:opacity-40 hover:bg-black/80"
        >
          {submitting ? "Submitting..." : `Submit ${selectedCount} Selection${selectedCount !== 1 ? "s" : ""}`}
        </button>
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={photos}
          currentIndex={lightboxIndex}
          selections={selections}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
          onToggleSelect={toggleSelect}
          onUpdateComment={updateComment}
        />
      )}
    </div>
  );
}
