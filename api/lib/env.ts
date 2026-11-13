import "dotenv/config";

const isProduction = process.env.NODE_ENV === "production";
const googleAppsScriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL ?? "";
const googleAppsScriptToken = process.env.GOOGLE_APPS_SCRIPT_TOKEN ?? "";
const databaseUrl = process.env.DATABASE_URL ?? "";
const resultsPassword = process.env.RESULTS_PASSWORD ?? "";
const progressPassword = process.env.PROGRESS_PASSWORD ?? "";

if (isProduction && !googleAppsScriptUrl && !databaseUrl) {
  throw new Error("Configure DATABASE_URL or GOOGLE_APPS_SCRIPT_URL.");
}
if (isProduction && googleAppsScriptUrl && !googleAppsScriptToken) {
  throw new Error("GOOGLE_APPS_SCRIPT_TOKEN is required when using Google Sheets.");
}
if (isProduction && (!resultsPassword || !progressPassword)) {
  throw new Error("RESULTS_PASSWORD and PROGRESS_PASSWORD are required in production.");
}

export const env = {
  isProduction,
  databaseUrl,
  googleAppsScriptUrl,
  googleAppsScriptToken,
  resultsPassword,
  progressPassword,
};
