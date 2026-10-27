import { StonkLoader } from "@/components/StonkLoader";
export default function Loading() {
  return (
    <main className="stonk-loading-page" aria-busy="true">
      <div role="status" aria-live="polite">
        <StonkLoader />
      </div>
    </main>
  );
}
