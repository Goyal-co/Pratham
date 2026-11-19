"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/http";
import { resolvePublicMediaUrl } from "@/lib/media-url";

type Asset = {
  id: string;
  url: string;
  filename: string;
  created_at: string;
};

export function MenuGallery() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ assets: Asset[] }>("/api/media?limit=48");
      setAssets(data.assets ?? []);
    } catch {
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  async function onUpload(file: File | null) {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/media", {
      method: "POST",
      body: fd,
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Upload failed");
      return;
    }
    setAssets((a) => [data.asset, ...a]);
  }

  async function onDelete(id: string) {
    if (!confirm("Remove this image from the gallery?")) return;
    setBusyId(id);
    try {
      await api(`/api/media/${id}`, { method: "DELETE" });
      setAssets((a) => a.filter((x) => x.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h2 style={{ margin: 0 }}>Image gallery</h2>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            Reuse these when adding dishes, or upload new photos.
          </p>
        </div>
        <label className="btn" style={{ width: "auto", cursor: "pointer" }}>
          Upload image
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            hidden
            onChange={(e) => {
              void onUpload(e.target.files?.[0] || null);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {loading ? (
        <p className="muted">Loading gallery…</p>
      ) : !assets.length ? (
        <p className="muted">No images yet.</p>
      ) : (
        <div className="gallery-grid" style={{ marginTop: 12 }}>
          {assets.map((a) => (
            <div key={a.id} className="gallery-tile static">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={resolvePublicMediaUrl(a.url)} alt={a.filename} />
              <button
                type="button"
                className="gallery-delete"
                disabled={busyId === a.id}
                onClick={() => onDelete(a.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
