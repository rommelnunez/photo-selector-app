"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import UploadZone from "@/components/UploadZone";

interface Photo {
  id: string;
  blob_url: string;
  filename: string;
  position: number;
}

interface Selection {
  id: string;
  photo_id: string;
  comment: string | null;
  submitted_at: string;
  photos: { blob_url: string; filename: string; position: number };
}

interface Gallery {
  id: string;
  name: string;
  slug: string;
  status: string;
  photos: Photo[];
}

export default function AdminGalleryPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [tab, setTab] = useState<"upload" | "selections">("upload");
  const [showSelectedOnly, setShowSelectedOnly] = useState(true);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadGallery = useCallback(async () => {
    const res = await fetch(`/api/admin/galleries/${id}`);
    if (res.ok) {
      const data = await res.json();
      setGallery(data);
    } else {
      router.push("/admin");
    }
    setLoading(false);
  }, [id, router]);

  const loadSelections = useCallback(async () => {
    const res = await fetch(`/api/admin/galleries/${id}/selections`);
    if (res.ok) {
      const data = await res.json();
      setSelections(data);
    }
  }, [id]);

  useEffect(() => {
    loadGallery();
    loadSelections();
  }, [loadGallery, loadSelections]);

  const existingFilenames = new Set(gallery?.photos.map((p) => p.filename) || []);

  const handleUploadComplete = useCallback(
    (photo: { blobUrl: string; filename: string; position: number }) => {
      setGallery((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          photos: [
            ...prev.photos,
            {
              id: crypto.randomUUID(),
              blob_url: photo.blobUrl,
              filename: photo.filename,
              position: photo.position,
            },
          ],
        };
      });
    },
    []
  );

  const copyFilenames = () => {
    const filenames = selections
      .map((s) => s.photos?.filename)
      .filter(Boolean)
      .sort()
      .join(", ");
    navigator.clipboard.writeText(filenames);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-text-secondary">Loading...</div>;
  }

  if (!gallery) return null;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8">
      {/* Header */}
      <button
        onClick={() => router.push("/admin")}
        className="text-sm text-text-secondary hover:text-black mb-4 cursor-pointer"
      >
        &larr; Back
      </button>

      <h1 className="text-xl font-bold tracking-tight mb-1">{gallery.name}</h1>
      <p className="text-sm text-text-secondary mb-6">
        /gallery/{gallery.slug} &middot; {gallery.photos.length} photos &middot;{" "}
        <span className="capitalize">{gallery.status}</span>
      </p>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-border mb-6">
        <button
          onClick={() => setTab("upload")}
          className={`pb-2 text-sm font-medium cursor-pointer ${
            tab === "upload" ? "border-b-2 border-black" : "text-text-secondary"
          }`}
        >
          Upload
        </button>
        <button
          onClick={() => setTab("selections")}
          className={`pb-2 text-sm font-medium cursor-pointer ${
            tab === "selections" ? "border-b-2 border-black" : "text-text-secondary"
          }`}
        >
          Selections
          {selections.length > 0 && (
            <span className="ml-1 text-text-secondary">({selections.length})</span>
          )}
        </button>
      </div>

      {tab === "upload" && (
        <div>
          <UploadZone
            galleryId={gallery.id}
            existingFilenames={existingFilenames}
            onUploadComplete={handleUploadComplete}
          />

          {/* Photo grid preview */}
          {gallery.photos.length > 0 && (
            <div className="mt-6 grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-1">
              {gallery.photos
                .sort((a, b) => a.position - b.position)
                .map((photo) => (
                  <div key={photo.id} className="relative aspect-square">
                    <Image
                      src={photo.blob_url}
                      alt={photo.filename}
                      fill
                      sizes="(max-width: 640px) 25vw, (max-width: 1024px) 16vw, 12vw"
                      className="object-cover"
                      loading="lazy"
                    />
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {tab === "selections" && (
        <div>
          {selections.length === 0 ? (
            <p className="text-text-secondary text-center py-8">
              No selections yet
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <p className="text-sm">
                  <span className="font-bold">{selections.length}</span> of{" "}
                  {gallery.photos.length} selected
                  {selections[0]?.submitted_at && (
                    <span className="text-text-secondary">
                      {" "}&middot; {new Date(selections[0].submitted_at).toLocaleDateString()}
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={copyFilenames}
                    className="border border-border px-3 py-1.5 text-sm cursor-pointer hover:bg-bg-secondary"
                  >
                    {copied ? "Copied!" : "Copy Filenames"}
                  </button>
                  <label className="flex items-center gap-1.5 text-sm text-text-secondary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showSelectedOnly}
                      onChange={(e) => setShowSelectedOnly(e.target.checked)}
                      className="accent-black"
                    />
                    Selected only
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-1">
                {(showSelectedOnly
                  ? selections
                      .map((s) => ({
                        ...s,
                        photo: gallery.photos.find((p) => p.id === s.photo_id) || {
                          id: s.photo_id,
                          blob_url: s.photos?.blob_url,
                          filename: s.photos?.filename,
                          position: s.photos?.position,
                        },
                      }))
                      .sort((a, b) => (a.photo?.position ?? 0) - (b.photo?.position ?? 0))
                  : gallery.photos.sort((a, b) => a.position - b.position).map((p) => {
                      const sel = selections.find((s) => s.photo_id === p.id);
                      return { ...sel, photo: p, isSelected: !!sel };
                    })
                ).map((item) => {
                  const isSelected = showSelectedOnly || (item as { isSelected?: boolean }).isSelected;
                  const photo = (item as { photo: Photo }).photo;
                  const comment = (item as Selection).comment;

                  return (
                    <div key={photo?.id || Math.random()} className="relative aspect-square group">
                      {photo?.blob_url && (
                        <Image
                          src={photo.blob_url}
                          alt={photo.filename || ""}
                          fill
                          sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 16vw"
                          className={`object-cover ${!isSelected ? "opacity-30" : ""}`}
                          loading="lazy"
                        />
                      )}
                      {isSelected && (
                        <div className="absolute top-1 right-1">
                          <span className="w-5 h-5 rounded-full bg-black flex items-center justify-center">
                            <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                              <path d="M2.5 7L5.5 10L11.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </span>
                        </div>
                      )}
                      {comment && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs px-1.5 py-1 truncate">
                          {comment}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
