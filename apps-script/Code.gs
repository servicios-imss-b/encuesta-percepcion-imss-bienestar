const SPREADSHEET_ID_PROPERTY = "SPREADSHEET_ID";
const SHEET_NAME = "Hoja 1";
const API_TOKEN_PROPERTY = "API_TOKEN";
const PANEL_TOKEN_PREFIX = "PANEL_TOKEN_";
const PANEL_TOKEN_TTL_SECONDS = 21600;
const PAYLOAD_PREFIX = "payload.";

function doGet(event) {
  const callback = String(event.parameter.callback || "");
  if (!/^__appsScriptCallback_[a-f0-9]+$/.test(callback)) {
    return ContentService.createTextOutput("Invalid callback.")
      .setMimeType(ContentService.MimeType.TEXT);
  }

  let request = {};
  let envelope;
  try {
    request = JSON.parse(event.parameter.bridgeRequest || "{}");
    envelope = {
      requestId: request.requestId || "",
      response: { ok: true, data: dispatchBridgeRequest_(request) },
    };
  } catch (error) {
    envelope = {
      requestId: request.requestId || "",
      response: { ok: false, error: String(error && error.message ? error.message : error) },
    };
  }

  return ContentService.createTextOutput(callback + "(" + JSON.stringify(envelope) + ");")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function doPost(event) {
  if (event.parameter && event.parameter.bridgeRequest) {
    return handleBridgeRequest_(event.parameter.bridgeRequest);
  }

  try {
    const request = JSON.parse(event.postData.contents || "{}");
    const expectedToken = PropertiesService.getScriptProperties().getProperty(API_TOKEN_PROPERTY);
    if (!expectedToken || request.token !== expectedToken) {
      return jsonOutput_({ ok: false, error: "Acceso no autorizado." });
    }

    let data;
    switch (request.action) {
      case "submit":
        data = appendResponse_(request.data || {});
        break;
      case "list":
        data = readResponses_().sort(compareResponses_);
        break;
      case "count": {
        const responses = readResponses_();
        data = {
          total: responses.length,
          directores: responses.filter((response) => response.perfil === "director").length,
          regionales: responses.filter((response) => response.perfil === "regional").length,
        };
        break;
      }
      case "responded":
        data = readResponses_()
          .filter((response) => !response.esPrueba)
          .sort(compareResponses_)
          .map((response) => ({
            id: response.id,
            perfil: response.perfil,
            clues: response.clues,
            hospital: response.hospital,
            entidad: response.entidad,
            cveEntidad: response.cveEntidad,
            categoria: response.categoria,
            cveRegion: response.cveRegion,
            region: response.region,
            createdAt: response.createdAt,
          }));
        break;
      default:
        return jsonOutput_({ ok: false, error: "Acción desconocida." });
    }

    return jsonOutput_({ ok: true, data: data });
  } catch (error) {
    return jsonOutput_({ ok: false, error: String(error && error.message ? error.message : error) });
  }
}

function handleBridgeRequest_(serializedRequest) {
  let request = {};
  try {
    request = JSON.parse(serializedRequest || "{}");
    const data = dispatchBridgeRequest_(request);
    return bridgeOutput_(request.requestId, { ok: true, data: data });
  } catch (error) {
    return bridgeOutput_(request.requestId, {
      ok: false,
      error: String(error && error.message ? error.message : error),
    });
  }
}

function dispatchBridgeRequest_(request) {
  const input = request.input || {};
  switch (request.path) {
    case "ping":
      return { ok: true, ts: Date.now() };
    case "survey.submit":
      return appendResponse_(input);
    case "survey.panelAuth":
      return authenticatePanel_(input);
    case "survey.list":
      requirePanel_(input.token, "resultados");
      return readResponses_().sort(compareResponses_);
    case "survey.count": {
      requirePanel_(input.token, "resultados");
      const responses = readResponses_();
      return {
        total: responses.length,
        directores: responses.filter((response) => response.perfil === "director").length,
        regionales: responses.filter((response) => response.perfil === "regional").length,
      };
    }
    case "survey.responded":
      requirePanel_(input.token, "avance");
      return readResponses_()
        .filter((response) => !response.esPrueba)
        .sort(compareResponses_)
        .map((response) => ({
          id: response.id,
          perfil: response.perfil,
          clues: response.clues,
          hospital: response.hospital,
          entidad: response.entidad,
          cveEntidad: response.cveEntidad,
          categoria: response.categoria,
          cveRegion: response.cveRegion,
          region: response.region,
          createdAt: response.createdAt,
        }));
    default:
      throw new Error("Acción desconocida.");
  }
}

function authenticatePanel_(input) {
  const panel = input.panel;
  const propertyName = panel === "resultados"
    ? "RESULTS_PASSWORD"
    : panel === "avance"
      ? "PROGRESS_PASSWORD"
      : "";
  const expectedPassword = propertyName
    ? PropertiesService.getScriptProperties().getProperty(propertyName)
    : "";
  if (!expectedPassword || input.password !== expectedPassword) {
    throw new Error("Contraseña incorrecta.");
  }

  const token = Utilities.getUuid();
  CacheService.getScriptCache().put(PANEL_TOKEN_PREFIX + token, panel, PANEL_TOKEN_TTL_SECONDS);
  return { token: token, panel: panel };
}

function requirePanel_(token, panel) {
  const activePanel = token
    ? CacheService.getScriptCache().get(PANEL_TOKEN_PREFIX + token)
    : "";
  if (activePanel !== panel) {
    throw new Error("Acceso no autorizado. Inicie sesión de nuevo.");
  }
}

function bridgeOutput_(requestId, response) {
  const envelope = Utilities.base64Encode(
    JSON.stringify({ requestId: requestId || "", response: response }),
    Utilities.Charset.UTF_8,
  );
  const html = "<!doctype html><html><head><meta charset=\"utf-8\"></head><body>" +
    "<script>" +
    "var binary=atob(\"" + envelope + "\");" +
    "var bytes=Uint8Array.from(binary,function(c){return c.charCodeAt(0);});" +
    "var message=JSON.parse(new TextDecoder().decode(bytes));" +
    "window.top.postMessage(message,\"*\");" +
    "</script></body></html>";
  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function verifySetup() {
  const sheet = responseSheet_();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  if (headers.length !== 60 || headers[0] !== "id" || headers[59] !== "payload.v2") {
    throw new Error("La hoja no coincide con los 60 encabezados esperados.");
  }
  const properties = PropertiesService.getScriptProperties();
  if (!properties.getProperty("RESULTS_PASSWORD") || !properties.getProperty("PROGRESS_PASSWORD")) {
    throw new Error("Configura RESULTS_PASSWORD y PROGRESS_PASSWORD como propiedades del script.");
  }
  return "Conexión y encabezados verificados.";
}

function responseSheet_() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_PROPERTY);
  if (!spreadsheetId) throw new Error("Configura la propiedad " + SPREADSHEET_ID_PROPERTY + ".");
  const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error("No existe la pestaña " + SHEET_NAME + ".");
  if (sheet.getLastColumn() !== 60) throw new Error("Se esperaban 60 columnas en la hoja.");
  return sheet;
}

function appendResponse_(response) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = responseSheet_();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
    const lastRow = sheet.getLastRow();
    const ids = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat().map(Number) : [];
    const validIds = ids.filter((id) => Number.isFinite(id));
    const id = (validIds.length ? Math.max.apply(null, validIds) : 0) + 1;
    const payload = response.payload || {};
    const row = headers.map((header) => {
      if (header === "id") return id;
      if (header === "createdAt") return new Date();
      if (header === "esPrueba") return response.esPrueba === true;
      if (header.indexOf(PAYLOAD_PREFIX) === 0) {
        return cellValue_(payload[header.slice(PAYLOAD_PREFIX.length)]);
      }
      return cellValue_(response[header]);
    });
    sheet.appendRow(row);
    return { id: id };
  } finally {
    lock.releaseLock();
  }
}

function readResponses_() {
  const sheet = responseSheet_();
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 2) return [];

  const values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
  const headers = values[0].map(String);
  return values.slice(1)
    .filter((row) => row[0] !== "" && row[0] !== null)
    .map((row) => {
      const record = {};
      headers.forEach((header, index) => { record[header] = row[index]; });
      const payload = {};
      headers.forEach((header, index) => {
        if (header.indexOf(PAYLOAD_PREFIX) === 0 && row[index] !== "" && row[index] !== null) {
          payload[header.slice(PAYLOAD_PREFIX.length)] = parseCell_(row[index]);
        }
      });
      return {
        id: Number(record.id),
        perfil: String(record.perfil || ""),
        cveEntidad: nullableNumber_(record.cveEntidad),
        entidad: String(record.entidad || ""),
        clues: nullableText_(record.clues),
        hospital: nullableText_(record.hospital),
        categoria: nullableText_(record.categoria),
        cveRegion: nullableNumber_(record.cveRegion),
        region: nullableText_(record.region),
        payload: payload,
        esPrueba: isTrue_(record.esPrueba),
        eDiferencia: nullableNumber_(record.eDiferencia),
        createdAt: isoDate_(record.createdAt),
      };
    });
}

function compareResponses_(left, right) {
  const dateOrder = String(right.createdAt || "").localeCompare(String(left.createdAt || ""));
  return dateOrder || right.id - left.id;
}

function nullableNumber_(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function nullableText_(value) {
  return value === "" || value === null || value === undefined ? null : String(value);
}

function isTrue_(value) {
  return value === true || value === 1 || String(value).toLowerCase() === "true";
}

function isoDate_(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function parseCell_(value) {
  if (typeof value !== "string") return value;
  const text = value.trim();
  if (text.charAt(0) === "{" || text.charAt(0) === "[") {
    try { return JSON.parse(text); } catch (error) { return value; }
  }
  return value;
}

function cellValue_(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

function jsonOutput_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}