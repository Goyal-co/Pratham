"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/http";
import { resolvePublicMediaUrl } from "@/lib/media-url";

type Asset = {
  id: string;
  url: string;
  filename: string;
};

export function ImagePicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ assets: Asset[] }>("/api/media");
      setAssets(data.assets ?? []);
    } catch {
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load().catch(() => undefined);
  }, [open, load]);

  async function onUpload(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/media", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onChange(data.asset.url);
      setAssets((a) => [data.asset, ...a]);
      setOpen(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="image-picker">
      <div className="image-picker-preview">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resolvePublicMediaUrl(value)} alt="Selected dish" />
        ) : (
          <span className="muted">No image</span>
        )}
      </div>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn secondary"
          onClick={() => setOpen(true)}
        >
          Choose from gallery
        </button>
        <label className="btn secondary" style={{ cursor: "pointer" }}>
          {uploading ? "Uploading…" : "Upload new"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            hidden
            disabled={uploading}
            onChange={(e) => onUpload(e.target.files?.[0] || null)}
          />
        </label>
        {value ? (
          <button
            type="button"
            className="btn secondary"
            onClick={() => onChange(null)}
          >
            Clear
          </button>
        ) : null}
      </div>

      {open && (
        <div className="gallery-modal" onClick={() => setOpen(false)}>
          <div
            className="gallery-modal-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>Image gallery</strong>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            <p className="muted" style={{ marginTop: 6 }}>
              Pick an existing upload or add a new one.
            </p>
            <label className="btn" style={{ width: "auto", cursor: "pointer" }}>
              {uploading ? "Uploading…" : "Upload new image"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                hidden
                disabled={uploading}
                onChange={(e) => onUpload(e.target.files?.[0] || null)}
              />
            </label>
            {loading ? (
              <p className="muted">Loading…</p>
            ) : !assets.length ? (
              <p className="muted">No images yet — upload the first one.</p>
            ) : (
              <div className="gallery-grid">
                {assets.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className={`gallery-tile${value === a.url ? " active" : ""}`}
                    onClick={() => {
                      onChange(a.url);
                      setOpen(false);
                    }}
                    title={a.filename}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={resolvePublicMediaUrl(a.url)} alt={a.filename} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
