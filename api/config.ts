// Configuración del servidor — NUNCA importar desde el frontend.
import { env } from "./lib/env";

export const RESULTS_PASSWORD = env.resultsPassword;
export const PROGRESS_PASSWORD = env.progressPassword;

// Duración del token de acceso a los paneles (12 horas)
export const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
