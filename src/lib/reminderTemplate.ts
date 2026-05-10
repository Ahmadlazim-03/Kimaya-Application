/**
 * Reminder template substitution.
 *
 * Builds the rendered message used for both WhatsApp delivery and Web Push
 * notifications. The available placeholders are documented as the SINGLE
 * source of truth — the form helper buttons in the admin UI reference this
 * same list.
 *
 * Substitution is `{key}` (single-brace). Missing values render as "-".
 */

import { buildMessage } from "@/lib/waha";

export interface ReminderVars {
  nama: string;
  tanggal: string;
  skor?: string | null;
  lokasi?: string | null;
  shift?: string | null;
  role?: string | null;
  departemen?: string | null;
  telepon?: string | null;
}

/** Variables exposed in the admin reminder form. Order matters for UI. */
export const REMINDER_PLACEHOLDERS: { var: string; desc: string }[] = [
  { var: "{nama}", desc: "Nama lengkap karyawan" },
  { var: "{tanggal}", desc: "Tanggal hari ini (lengkap)" },
  { var: "{skor}", desc: "Skor performa terakhir" },
  { var: "{lokasi}", desc: "Lokasi cabang" },
  { var: "{shift}", desc: "Nama shift kerja" },
  { var: "{role}", desc: "Jabatan / role" },
  { var: "{departemen}", desc: "Departemen" },
  { var: "{telepon}", desc: "Nomor telepon" },
];

const ROLE_LABELS: Record<string, string> = {
  DEVELOPER: "Developer",
  MANAGER: "Manager",
  CS: "Customer Service",
  THERAPIST: "Therapist",
};

/**
 * Render a reminder template against a recipient's data.
 * Always returns a string — empty/null vars become "-".
 */
export function renderReminderMessage(template: string, vars: ReminderVars): string {
  const safe: Record<string, string> = {
    nama: vars.nama || "-",
    tanggal: vars.tanggal || "-",
    skor: vars.skor || "-",
    lokasi: vars.lokasi || "-",
    shift: vars.shift || "-",
    role: vars.role ? (ROLE_LABELS[vars.role] || vars.role) : "-",
    departemen: vars.departemen || "-",
    telepon: vars.telepon || "-",
  };
  return buildMessage(template, safe);
}

/**
 * Indonesian-formatted long date for the {tanggal} placeholder.
 */
export function formatTodayId(date: Date = new Date()): string {
  return date.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
