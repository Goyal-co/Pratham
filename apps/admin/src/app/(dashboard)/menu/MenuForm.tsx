"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/http";

export function MenuForm({ defaultDate }: { defaultDate?: string }) {
  const router = useRouter();
  const [mealType, setMealType] = useState("lunch");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("80");
  const [menuDate, setMenuDate] = useState(defaultDate || "");
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
          menu_date: menuDate || null,
        },
      });
      setName("");
      setDescription("");
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
          />
          <span className="muted" style={{ fontWeight: 400 }}>
            Leave empty for catalog default (used when no day menu is set).
          </span>
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
          {busy ? "Adding…" : "Add item"}
        </button>
      </div>
    </form>
  );
}
