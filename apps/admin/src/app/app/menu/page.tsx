import { Suspense } from "react";
import MenuInner from "./MenuInner";

export default function StudentMenuPage() {
  return (
    <Suspense
      fallback={
        <div>
          <h1 className="v2-page-title">Menu</h1>
          <div className="student-skeleton" style={{ height: 180 }} />
        </div>
      }
    >
      <MenuInner />
    </Suspense>
  );
}
