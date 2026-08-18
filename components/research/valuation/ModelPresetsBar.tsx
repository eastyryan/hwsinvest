"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deletePreset,
  listPresets,
  savePreset,
  type ModelPreset,
} from "@/lib/research/model-presets";
import { btnCompact } from "../ui/buttonStyles";

/**
 * Named DCF (and other) assumption slots per ticker — free, localStorage only.
 */
export default function ModelPresetsBar({
  ticker,
  capture,
  onLoad,
}: {
  ticker: string;
  /** Snapshot current model state into a payload bag */
  capture: () => Record<string, unknown>;
  /** Apply a saved payload */
  onLoad: (payload: Record<string, unknown>) => void;
}) {
  const [presets, setPresets] = useState<ModelPreset[]>([]);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setPresets(listPresets(ticker));
  }, [ticker]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function handleSave() {
    const n = name.trim() || `Case ${new Date().toLocaleString()}`;
    savePreset({
      name: n,
      ticker,
      payload: capture(),
    });
    setName("");
    setMsg(`Saved “${n}”`);
    refresh();
    window.setTimeout(() => setMsg(null), 2000);
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-900/30">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-tight">
            Saved model cases
          </p>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Free local presets (up to 20) — not synced to the cloud.
          </p>
        </div>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] font-medium text-zinc-500">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Bull case"
            className="w-36 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <button type="button" className={btnCompact} onClick={handleSave}>
          Save current
        </button>
      </div>
      {msg && (
        <p className="mt-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
          {msg}
        </p>
      )}
      {presets.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {presets.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5 text-xs dark:bg-zinc-950"
            >
              <span className="min-w-0 truncate font-medium">{p.name}</span>
              <span className="font-mono text-[10px] text-zinc-400">
                {new Date(p.updatedAt).toLocaleDateString()}
              </span>
              <span className="flex gap-2">
                <button
                  type="button"
                  className="font-medium text-sky-700 underline-offset-2 hover:underline dark:text-sky-300"
                  onClick={() => onLoad(p.payload)}
                >
                  Load
                </button>
                <button
                  type="button"
                  className="text-zinc-500 hover:text-red-600"
                  onClick={() => {
                    deletePreset(ticker, p.id);
                    refresh();
                  }}
                >
                  Delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[11px] text-zinc-500">
          No saved cases yet — tune assumptions, then save.
        </p>
      )}
    </div>
  );
}
