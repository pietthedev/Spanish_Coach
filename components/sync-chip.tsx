"use client";
import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { useRumbo } from "./app-providers";

export function SyncChip() {
  const { syncStatus, profile } = useRumbo();
  const map = {
    local: [CloudOff, "Saved locally"],
    syncing: [RefreshCw, "Synchronising"],
    synced: [Cloud, "Synced"],
    error: [CloudOff, "Saved — sync retrying"],
  } as const;
  const [Icon, label] = profile?.isDemo
    ? ([CloudOff, "Demo · local only"] as const)
    : map[syncStatus];
  return (
    <span className="text-ink/70 inline-flex min-h-8 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-bold">
      <Icon size={14} aria-hidden="true" />
      {label}
    </span>
  );
}
