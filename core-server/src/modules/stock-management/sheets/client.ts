import { logger } from "@shared/logger";
import { google, sheets_v4 } from "googleapis";
import { getServiceAccountPath } from "../config";
import { GoogleAuth } from "google-auth-library";

let _auth: GoogleAuth | null = null;
let _sheets: sheets_v4.Sheets | null = null;

async function getAuth(): Promise<GoogleAuth | null> {
  if (_auth) return _auth;

  const serviceAccPath = getServiceAccountPath();
  if (!serviceAccPath) {
    return null;
  }

  try {
    const auth = new GoogleAuth({
      keyFile: serviceAccPath,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    _auth = auth;
    return _auth;
  } catch (err) {
    logger.error("stocks:sheets", "Auth error:", err);
    return null;
  }
}

export async function getSheetsClient(): Promise<sheets_v4.Sheets | null> {
  if (_sheets) return _sheets;

  const auth = await getAuth();
  if (!auth) return null;

  _sheets = google.sheets({ version: "v4", auth });
  return _sheets;
}

export async function readRange(
  spreadsheetId: string,
  range: string,
): Promise<string[][]> {
  const sheets = await getSheetsClient();
  if (!sheets)
    throw new Error("[Client] Sheets client unavailable — check service.json");
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  return (res.data.values as string[][]) ?? [];
}

export async function writeRange(
  spreadsheetId: string,
  range: string,
  values: unknown[][],
): Promise<void> {
  const sheets = await getSheetsClient();
  if (!sheets)
    throw new Error("[Client] Sheets client unavailable — check service.json");
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "RAW",
    requestBody: {
      values,
    },
  });
}

export async function appendRows(
  spreadsheetId: string,
  range: string,
  values: unknown[][],
): Promise<void> {
  const sheets = await getSheetsClient();
  if (!sheets)
    throw new Error("[Client] Sheets client unavailable — check service.json");
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values,
    },
  });
}

export async function deleteRow(
  sheetTitle: string,
  spreadsheetId: string,
  rowNum: number,
): Promise<void> {
  const sheets = await getSheetsClient();
  if (!sheets)
    throw new Error("[Client] Sheets client unavailable — check service.json");

  const res = await sheets.spreadsheets.get({
    spreadsheetId,
  });
  const sheet = res.data.sheets?.find(
    (s: any) => s.properties?.title === sheetTitle,
  );
  const sheetId = sheet?.properties?.sheetId;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              dimension: "ROWS",
              sheetId,
              startIndex: rowNum - 1,
              endIndex: rowNum,
            },
          },
        },
      ],
    },
  });
}

export async function batchRead(
  spreadsheetId: string,
  ranges: string[],
): Promise<string[][][]> {
  const sheets = await getSheetsClient();

  if (!sheets) {
    throw new Error("[Client] Sheets client unavailable — check service.json");
  }

  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges,
  });

  return (
    res.data.valueRanges?.map((vr) => (vr.values ?? []) as string[][]) ?? []
  );
}
