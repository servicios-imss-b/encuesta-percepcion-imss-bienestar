const SPREADSHEET_ID_PROPERTY = "SPREADSHEET_ID";
const SHEET_NAME = "Hoja 1";
const API_TOKEN_PROPERTY = "API_TOKEN";
const PAYLOAD_PREFIX = "payload.";

function doPost(event) {
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

function verifySetup() {
  const sheet = responseSheet_();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  if (headers.length !== 60 || headers[0] !== "id" || headers[59] !== "payload.v2") {
    throw new Error("La hoja no coincide con los 60 encabezados esperados.");
  }
  if (!PropertiesService.getScriptProperties().getProperty(API_TOKEN_PROPERTY)) {
    throw new Error("Configura la propiedad de script API_TOKEN antes de desplegar.");
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