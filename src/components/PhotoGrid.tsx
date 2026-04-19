"use client";

import Image from "next/image";

interface Photo {
  id: string;
  blob_url: string;
  filename: string;
  position: number;
}

interface PhotoGridProps {
  photos: Photo[];
  selections: Map<string, { selected: boolean; comment: string }>;
  onToggleSelect: (photoId: string) => void;
  onOpenPhoto: (index: number) => void;
}

export default function PhotoGrid({ photos, selections, onToggleSelect, onOpenPhoto }: PhotoGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1 sm:gap-2">
      {photos.map((photo, index) => {
        const sel = selections.get(photo.id);
        const isSelected = sel?.selected ?? false;

        return (
          <div key={photo.id} className="relative aspect-square group">
            {/* Photo */}
            <button
              type="button"
              className="w-full h-full block overflow-hidden cursor-pointer"
              onClick={() => onOpenPhoto(index)}
              aria-label={`View ${photo.filename}`}
            >
              <Image
                src={photo.blob_url}
                alt={photo.filename}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                className="object-cover"
                loading="lazy"
              />
            </button>

            {/* Select circle — always visible */}
            <button
              type="button"
              className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center z-10 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect(photo.id);
              }}
              aria-label={isSelected ? "Deselect photo" : "Select photo"}
            >
              {isSelected ? (
                <span className="w-7 h-7 rounded-full bg-black flex items-center justify-center shadow-md">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2.5 7L5.5 10L11.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              ) : (
                <span className="w-7 h-7 rounded-full border-2 border-white bg-black/20 shadow-md" />
              )}
            </button>

            {/* Selected border overlay */}
            {isSelected && (
              <div className="absolute inset-0 border-3 border-black pointer-events-none" />
            )}
          </div>
        );
      })}
    </div>
  );
}
