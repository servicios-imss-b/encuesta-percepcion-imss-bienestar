import { env } from "../lib/env";

export type SheetResponse = {
  id: number;
  perfil: "director" | "regional";
  cveEntidad: number;
  entidad: string;
  clues: string | null;
  hospital: string | null;
  categoria: string | null;
  cveRegion: number | null;
  region: string | null;
  payload: Record<string, unknown>;
  esPrueba: boolean;
  eDiferencia: number | null;
  createdAt: string | null;
};

export async function callAppsScript<T>(action: string, data?: unknown): Promise<T> {
  if (!env.googleAppsScriptUrl) {
    throw new Error("GOOGLE_APPS_SCRIPT_URL no está configurada.");
  }
  if (!env.googleAppsScriptToken) {
    throw new Error("GOOGLE_APPS_SCRIPT_TOKEN no está configurada.");
  }

  const response = await fetch(env.googleAppsScriptUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, token: env.googleAppsScriptToken, data }),
  });

  let result: { ok?: boolean; data?: T; error?: string };
  try {
    result = (await response.json()) as typeof result;
  } catch {
    throw new Error(`Apps Script devolvió una respuesta no válida (${response.status}).`);
  }

  if (!response.ok || !result.ok) {
    throw new Error(result.error ?? `Falló la solicitud a Apps Script (${response.status}).`);
  }

  return result.data as T;
}