"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function StudentsSearch({ q }: { q: string }) {
  const router = useRouter();
  const [value, setValue] = useState(q);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next = value.trim();
    router.push(next ? `/students?q=${encodeURIComponent(next)}` : "/students");
  }

  return (
    <form className="row" onSubmit={onSubmit}>
      <label className="field" style={{ marginBottom: 0, minWidth: 280 }}>
        Search name / phone / email
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Rahul or 98765…"
        />
      </label>
      <button className="btn secondary" type="submit">
        Search
      </button>
    </form>
  );
}
