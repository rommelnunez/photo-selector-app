"use client";

import Image from "next/image";
import { useEffect, useCallback, useRef } from "react";

interface Photo {
  id: string;
  blob_url: string;
  filename: string;
}

interface PhotoLightboxProps {
  photos: Photo[];
  currentIndex: number;
  selections: Map<string, { selected: boolean; comment: string }>;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onToggleSelect: (photoId: string) => void;
  onUpdateComment: (photoId: string, comment: string) => void;
}

export default function PhotoLightbox({
  photos,
  currentIndex,
  selections,
  onClose,
  onNavigate,
  onToggleSelect,
  onUpdateComment,
}: PhotoLightboxProps) {
  const photo = photos[currentIndex];
  const sel = selections.get(photo.id);
  const isSelected = sel?.selected ?? false;
  const comment = sel?.comment ?? "";
  const commentRef = useRef<HTMLInputElement>(null);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) onNavigate(currentIndex - 1);
  }, [currentIndex, onNavigate]);

  const goNext = useCallback(() => {
    if (currentIndex < photos.length - 1) onNavigate(currentIndex + 1);
  }, [currentIndex, photos.length, onNavigate]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Don't capture arrow keys when typing in comment
      if (document.activeElement === commentRef.current) return;

      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, goPrev, goNext]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 text-white flex-shrink-0">
        <span className="text-sm font-light">
          {photo.filename} &middot; {currentIndex + 1} / {photos.length}
        </span>
        <button
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center text-2xl cursor-pointer"
          aria-label="Close"
        >
          &times;
        </button>
      </div>

      {/* Image area with nav */}
      <div className="flex-1 relative flex items-center justify-center min-h-0">
        {/* Left nav zone */}
        <button
          onClick={goPrev}
          className="absolute left-0 top-0 bottom-0 w-1/4 sm:w-20 z-10 flex items-center justify-start pl-2 sm:pl-4 cursor-pointer"
          disabled={currentIndex === 0}
          aria-label="Previous photo"
        >
          {currentIndex > 0 && (
            <span className="text-white/70 text-3xl">&lsaquo;</span>
          )}
        </button>

        {/* Photo */}
        <div className="relative w-full h-full">
          <Image
            src={photo.blob_url}
            alt={photo.filename}
            fill
            sizes="100vw"
            className="object-contain"
            priority
          />
        </div>

        {/* Right nav zone */}
        <button
          onClick={goNext}
          className="absolute right-0 top-0 bottom-0 w-1/4 sm:w-20 z-10 flex items-center justify-end pr-2 sm:pr-4 cursor-pointer"
          disabled={currentIndex === photos.length - 1}
          aria-label="Next photo"
        >
          {currentIndex < photos.length - 1 && (
            <span className="text-white/70 text-3xl">&rsaquo;</span>
          )}
        </button>
      </div>

      {/* Bottom controls — always visible */}
      <div className="flex-shrink-0 px-4 py-3 flex items-center gap-3 bg-black/90 border-t border-white/10"
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      >
        <button
          onClick={() => onToggleSelect(photo.id)}
          className={`px-4 py-2 text-sm font-medium flex-shrink-0 cursor-pointer transition-colors ${
            isSelected
              ? "bg-white text-black"
              : "border border-white/40 text-white"
          }`}
          aria-label={isSelected ? "Deselect" : "Select"}
        >
          {isSelected ? "Selected" : "Select"}
        </button>

        <input
          ref={commentRef}
          type="text"
          placeholder="Add comment..."
          value={comment}
          onChange={(e) => onUpdateComment(photo.id, e.target.value)}
          className="flex-1 bg-transparent border border-white/20 text-white px-3 py-2 text-sm placeholder-white/40 focus:outline-none focus:border-white/60"
        />
      </div>
    </div>
  );
}
