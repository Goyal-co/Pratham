"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/http";
import { ImagePicker } from "@/components/menu/ImagePicker";

export function MenuForm({ defaultDate }: { defaultDate?: string }) {
  const router = useRouter();
  const [mealType, setMealType] = useState("lunch");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("80");
  const [menuDate, setMenuDate] = useState(defaultDate || "");
  const [asCatalog, setAsCatalog] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/menu", {
        method: "POST",
        json: {
          meal_type: mealType,
          name,
          description,
          price: Number(price),
          menu_date: asCatalog ? null : menuDate || defaultDate || null,
          image_url: imageUrl,
        },
      });
      setName("");
      setDescription("");
      setImageUrl(null);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="row">
        <label className="field">
          For date
          <input
            type="date"
            value={menuDate}
            onChange={(e) => setMenuDate(e.target.value)}
            disabled={asCatalog}
            required={!asCatalog}
          />
        </label>
        <label className="field">
          Meal
          <select value={mealType} onChange={(e) => setMealType(e.target.value)}>
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
          </select>
        </label>
      </div>
      <label
        className="field"
        style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
      >
        <input
          type="checkbox"
          checked={asCatalog}
          onChange={(e) => setAsCatalog(e.target.checked)}
        />
        <span style={{ fontWeight: 500 }}>Save as catalog default (no date)</span>
      </label>
      <div className="field">
        <span>Dish image</span>
        <ImagePicker value={imageUrl} onChange={setImageUrl} />
      </div>
      <div className="row">
        <label className="field">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="field">
          Description
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="field">
          Price (₹)
          <input
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </label>
        <button className="btn" disabled={busy}>
          {busy ? "Adding…" : "Add dish"}
        </button>
      </div>
    </form>
  );
}
