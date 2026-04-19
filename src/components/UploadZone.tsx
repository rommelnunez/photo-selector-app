"use client";

import { useCallback, useRef, useState } from "react";

interface UploadZoneProps {
  galleryId: string;
  existingFilenames: Set<string>;
  onUploadComplete: (photo: { blobUrl: string; filename: string; position: number }) => void;
}

export default function UploadZone({ galleryId, existingFilenames, onUploadComplete }: UploadZoneProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const uploadFiles = useCallback(async (files: File[]) => {
    // Filter out already-uploaded files
    const newFiles = files
      .filter((f) => !existingFilenames.has(f.name))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (newFiles.length === 0) {
      setError("All files already uploaded");
      return;
    }

    setUploading(true);
    setError(null);
    setProgress({ done: 0, total: newFiles.length });

    const basePosition = existingFilenames.size;
    const concurrency = 6;
    let completed = 0;

    const uploadOne = async (file: File, index: number) => {
      const position = basePosition + index;
      let retries = 0;

      while (retries < 3) {
        try {
          // Step 1: Upload to Vercel Blob via our API
          const formData = new FormData();
          formData.append("file", file);
          formData.append("galleryId", galleryId);

          const uploadRes = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });

          if (!uploadRes.ok) throw new Error("Upload failed");
          const { url } = await uploadRes.json();

          // Step 2: Register in DB
          const registerRes = await fetch(`/api/admin/galleries/${galleryId}/photos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ blobUrl: url, filename: file.name, position }),
          });

          if (!registerRes.ok) throw new Error("Registration failed");

          onUploadComplete({ blobUrl: url, filename: file.name, position });
          completed++;
          setProgress({ done: completed, total: newFiles.length });
          return;
        } catch {
          retries++;
          if (retries === 3) {
            setError(`Failed to upload ${file.name} after 3 retries`);
          }
        }
      }
    };

    // Process in batches of `concurrency`
    for (let i = 0; i < newFiles.length; i += concurrency) {
      const batch = newFiles.slice(i, i + concurrency);
      await Promise.all(batch.map((file, j) => uploadOne(file, i + j)));
    }

    setUploading(false);
  }, [galleryId, existingFilenames, onUploadComplete]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/")
    );
    if (files.length > 0) uploadFiles(files);
  }, [uploadFiles]);

  const handleSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) uploadFiles(files);
  }, [uploadFiles]);

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed p-12 text-center cursor-pointer transition-colors ${
          dragOver ? "border-black bg-bg-secondary" : "border-border"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <p className="text-text-secondary font-light">
          {uploading
            ? `Uploading ${progress.done} / ${progress.total}...`
            : "Drop photos here or click to browse"}
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={handleSelect}
        />
      </div>

      {uploading && (
        <div className="w-full bg-bg-secondary h-1">
          <div
            className="bg-black h-1 transition-all duration-300"
            style={{ width: `${(progress.done / progress.total) * 100}%` }}
          />
        </div>
      )}

      {error && <p className="text-text-secondary text-sm">{error}</p>}
    </div>
  );
}
