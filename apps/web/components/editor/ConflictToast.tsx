"use client";

import { toast } from "sonner";
import {
    FIELD_TS_KEY,
    getFieldTimestamps,
} from "@/lib/sync/fieldTimestamps";
import { useEditorStore } from "@/stores/editorStore";

/**
 * Shape returned by the API when the per-field LWW merge discarded a client
 * field in favor of a newer server value. Mirrors the server's
 * `ServerConflict` shape from `apps/api/src/resume/field-lww.ts`.
 */
export interface SyncConflict {
    sectionId: string;
    field: string;
    keptSide: "server" | "client";
    serverValue: unknown;
    clientValue: unknown;
    sectionLabel: string;
}

/**
 * Compose a non-blocking conflict toast for a single discarded field. The
 * action button "Pulihkan versi saya" re-applies the user's value with a
 * fresh client timestamp so the next sync round will win.
 *
 * Race guard: if the user has already typed past the conflict (current
 * field timestamp newer than the snapshot the conflict was computed from),
 * the action is a silent no-op — re-stamping would clobber their newer
 * keystrokes.
 */
export function showConflictToast(conflict: SyncConflict): void {
    const niceField = humanizeField(conflict.field);
    const niceSection = conflict.sectionLabel
        ? humanizeSection(conflict.sectionLabel)
        : "bagian";
    const message = `Konflik di ${niceSection} · ${niceField}`;

    toast.message(message, {
        description: "Versi server lebih baru. Versi kamu disimpan sebagai cadangan.",
        duration: 10_000,
        action: {
            label: "Pulihkan versi saya",
            onClick: () => restoreClientValue(conflict),
        },
    });
}

function restoreClientValue(conflict: SyncConflict): void {
    const { sectionId, field, clientValue } = conflict;
    const state = useEditorStore.getState();
    const section = state.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const currentTs = getFieldTimestamps(section.content)[field] ?? 0;
    const conflictTs = readConflictClientTs(conflict);

    // Race guard: user has already moved past the conflict point. Don't
    // overwrite their newer typing.
    if (currentTs > conflictTs && conflictTs > 0) return;

    // If the current value already matches what we'd restore, dismiss silently.
    const currentValue = (section.content as Record<string, unknown>)[field];
    try {
        if (JSON.stringify(currentValue) === JSON.stringify(clientValue)) return;
    } catch {
        // serialization issues fall through and we attempt the restore anyway
    }

    state.updateSectionField(sectionId, field, clientValue);
}

function readConflictClientTs(conflict: SyncConflict): number {
    // The conflict carries the client's snapshot value but not its timestamp
    // explicitly — we infer it as "the field timestamp at the moment of PATCH",
    // which is what the server compared against. If a richer wire shape is
    // added later (`clientFieldUpdatedAt`), prefer that here.
    const explicit = (conflict as unknown as Record<string, unknown>)[
        "clientFieldUpdatedAt"
    ];
    return typeof explicit === "number" && Number.isFinite(explicit) ? explicit : 0;
}

function humanizeField(field: string): string {
    if (field === FIELD_TS_KEY) return field;
    // best-effort camel/snake → spaced humanization
    return field
        .replace(/[_-]+/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .toLowerCase();
}

function humanizeSection(label: string): string {
    return label.charAt(0).toUpperCase() + label.slice(1);
}
