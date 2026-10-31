"use client";
import { useAppSettings } from "@/components/shared/AppSettings";
import { useRef, useState } from "react";
import type { OptionsData } from "@/lib/options/analytics-types";
import { StatCard } from "@/components/shared/StatCard";
import styles from "./CsvUpload.module.css";

export function CsvUpload({
  onImport,
  onRemove,
}: {
  onImport: (data: OptionsData) => void;
  onRemove?: () => void;
}) {
  const { demo } = useAppSettings();
  const input = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function upload(files: File[]) {
    if (busy.current || !files.length) return;
    setError("");
    setMessage("");
    if (
      files.length > 20 ||
      files.some((f) => !/\.csv$/i.test(f.name) || f.size === 0) ||
      files.reduce((sum, f) => sum + f.size, 0) > 10_000_000
    ) {
      setError("Choose 1–20 non-empty CSV files, up to 10 MB in total.");
      return;
    }
    busy.current = true;
    setPending(true);
    try {
      const form = new FormData();
      for (const file of files) form.append("files", file);
      const response = await fetch("/api/options-import", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(60_000),
      });
      const result = await response.json();
      if (!response.ok || !result.data) {
        setError(
          result.error || "Import failed. Your previous view is unchanged.",
        );
        return;
      }
      onImport(result.data);
      setMessage(
        "CSV applied. Historical analytics now use your uploaded exports only.",
      );
    } catch {
      setError(
        "Upload failed or timed out. Your previous view is unchanged; try again.",
      );
    } finally {
      setPending(false);
      busy.current = false;
      if (input.current) input.current.value = "";
    }
  }
  if (demo)
    return (
      <StatCard title="Wealthsimple activity import">
        <p>
          Uploads are disabled in demo mode. All displayed trades are fictional;
          turn demo mode off to analyze your own exports.
        </p>
      </StatCard>
    );
  return (
    <StatCard
      title="Import Wealthsimple activity"
      action={<span>CSV first</span>}
    >
      <div
        className={`${styles.dropzone} ${dragging ? styles.dragging : ""}`}
        role="region"
        aria-label="Wealthsimple CSV drop area"
        aria-busy={pending}
        onDragOver={(event) => {
          event.preventDefault();
          if (!pending) setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void upload(Array.from(event.dataTransfer.files));
        }}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5" />
        </svg>
        <div>
          <strong>Drop your activity CSV here</strong>
          <p>
            Or choose files from your computer. Up to 20 files · 10 MB total.
          </p>
        </div>
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          multiple
          hidden
          aria-label="Wealthsimple activity CSV files"
          onChange={(event) =>
            void upload(Array.from(event.target.files || []))
          }
        />
        <button
          type="button"
          className={styles.choose}
          disabled={pending}
          onClick={() => input.current?.click()}
        >
          {pending ? "Processing CSV…" : "Choose CSV files"}
        </button>
      </div>
      <p className={styles.note}>
        Use the Wealthsimple activity export, not a realized gain/loss report.
        CSV trades take priority; SnapTrade fills are not mixed into the
        imported history. Incomplete trades still need review.
      </p>
      <p className={styles.note}>
        Uploads are processed temporarily on this app’s server and held only in
        this page’s memory. A full reload clears the upload. Nothing is saved to
        disk, Git, or sent to SnapTrade.
      </p>
      <p role="status" className={styles.status}>
        {pending
          ? "Validating export and calculating options history…"
          : message}
      </p>
      {error && <p role="alert">{error}</p>}
      {onRemove && (
        <button
          type="button"
          className={styles.remove}
          disabled={pending}
          onClick={() => {
            onRemove();
            setError("");
            setMessage("Upload removed. Showing the original data source.");
          }}
        >
          Remove uploaded CSV
        </button>
      )}
    </StatCard>
  );
}
