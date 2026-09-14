"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClubData, RosterEntry } from "@/lib/club-store";
import type { ClubEvent } from "@/data/calendar";

const LOCAL_KEY = "hws_club_data_v1";
const EMPTY: ClubData = { roster: [], events: [], updated: "" };

export type SaveState =
  | { kind: "loading" }
  | { kind: "idle"; local: boolean; updated: string }
  | { kind: "saving" }
  | { kind: "error"; message: string };

function readLocal(): ClubData | null {
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as ClubData) : null;
  } catch {
    return null;
  }
}

function writeLocal(data: ClubData) {
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
  } catch {
    // Private browsing or a full quota. The server copy is the real one.
  }
}

/**
 * Roster + custom events, backed by the Dropbox-hosted club.json. When Dropbox
 * isn't configured the same data lives in this browser's localStorage so the
 * console still works; the UI says which of the two is in play.
 */
export function useClubData() {
  const [data, setData] = useState<ClubData>(EMPTY);
  const [state, setState] = useState<SaveState>({ kind: "loading" });
  // Whether this browser is the only place the data lives.
  const localOnly = useRef(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const cached = readLocal();
      try {
        const res = await fetch("/api/club", { cache: "no-store" });
        const json = await res.json();
        if (!live) return;
        if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status})`);

        localOnly.current = json.storage !== "dropbox";
        const server = (json.data ?? EMPTY) as ClubData;
        // A local draft survives an unconfigured deploy; once the server copy
        // is empty but the browser has one, carry the browser's forward.
        const serverEmpty = server.roster.length === 0 && server.events.length === 0;
        const next = localOnly.current || (serverEmpty && cached) ? cached ?? server : server;

        setData(next);
        setState({ kind: "idle", local: localOnly.current, updated: next.updated });
      } catch (e) {
        if (!live) return;
        localOnly.current = true;
        setData(cached ?? EMPTY);
        setState({
          kind: "error",
          message: e instanceof Error ? e.message : "Could not load club data",
        });
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const save = useCallback(async (next: ClubData) => {
    setData(next);
    writeLocal(next); // always keep a browser copy as a safety net
    if (localOnly.current) {
      setState({ kind: "idle", local: true, updated: new Date().toISOString() });
      return;
    }
    setState({ kind: "saving" });
    try {
      const res = await fetch("/api/club", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roster: next.roster, events: next.events }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `Save failed (${res.status})`);
      setData(json.data as ClubData);
      setState({ kind: "idle", local: false, updated: (json.data as ClubData).updated });
    } catch (e) {
      setState({
        kind: "error",
        message: e instanceof Error ? e.message : "Save failed",
      });
    }
  }, []);

  const setRoster = useCallback(
    (roster: RosterEntry[]) => save({ ...data, roster }),
    [data, save]
  );
  const setEvents = useCallback(
    (events: ClubEvent[]) => save({ ...data, events }),
    [data, save]
  );

  return { data, state, setRoster, setEvents };
}
