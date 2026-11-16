"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { formatInr } from "@pratham/shared";
import { api } from "@/lib/http";
import { ImagePicker } from "@/components/menu/ImagePicker";

export type MenuItemRow = {
  id: string;
  meal_type: string;
  name: string;
  description: string | null;
  price: number | string;
  menu_date: string | null;
  image_url?: string | null;
};

export function MenuItemActions({ item }: { item: MenuItemRow }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mealType, setMealType] = useState(item.meal_type);
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description || "");
  const [price, setPrice] = useState(String(item.price));
  const [menuDate, setMenuDate] = useState(item.menu_date || "");
  const [imageUrl, setImageUrl] = useState<string | null>(item.image_url || null);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/api/menu/${item.id}`, {
        method: "PATCH",
        json: {
          meal_type: mealType,
          name,
          description,
          price: Number(price),
          menu_date: menuDate || null,
          image_url: imageUrl,
        },
      });
      setEditing(false);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!confirm(`Remove “${item.name}” from the menu?`)) return;
    setBusy(true);
    try {
      await api(`/api/menu/${item.id}`, { method: "DELETE" });
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <tr>
        <td colSpan={5}>
          <form onSubmit={onSave} className="menu-edit-form">
            <div className="row">
              <label className="field">
                Meal
                <select
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value)}
                >
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                </select>
              </label>
              <label className="field">
                Date (empty = catalog)
                <input
                  type="date"
                  value={menuDate}
                  onChange={(e) => setMenuDate(e.target.value)}
                />
              </label>
              <label className="field">
                Name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
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
            </div>
            <div className="field" style={{ marginTop: 8 }}>
              <span>Dish image</span>
              <ImagePicker value={imageUrl} onChange={setImageUrl} />
            </div>
            <div className="row" style={{ marginTop: 4 }}>
              <button className="btn" disabled={busy} type="submit">
                {busy ? "Saving…" : "Save"}
              </button>
              <button
                className="btn secondary"
                type="button"
                disabled={busy}
                onClick={() => {
                  setMealType(item.meal_type);
                  setName(item.name);
                  setDescription(item.description || "");
                  setPrice(String(item.price));
                  setMenuDate(item.menu_date || "");
                  setImageUrl(item.image_url || null);
                  setEditing(false);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td style={{ textTransform: "capitalize" }}>{item.meal_type}</td>
      <td>
        <div className="row" style={{ gap: 10, alignItems: "center" }}>
          {item.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.image_url}
              alt=""
              style={{
                width: 44,
                height: 44,
                objectFit: "cover",
                borderRadius: 8,
              }}
            />
          ) : null}
          <div>
            <div>{item.name}</div>
            {item.description ? (
              <div className="muted">{item.description}</div>
            ) : null}
          </div>
        </div>
      </td>
      <td>{formatInr(Number(item.price))}</td>
      <td>
        <div className="row" style={{ alignItems: "center", gap: 6 }}>
          <button
            className="btn secondary"
            type="button"
            disabled={busy}
            onClick={() => setEditing(true)}
          >
            Edit
          </button>
          <button
            className="btn danger"
            type="button"
            disabled={busy}
            onClick={onDelete}
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}
