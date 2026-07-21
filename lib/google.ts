import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";

const AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const USERINFO = "https://www.googleapis.com/oauth2/v2/userinfo";
const DRIVE = "https://www.googleapis.com/drive/v3";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/documents.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

const clientId = () => process.env.GOOGLE_CLIENT_ID || "";
const clientSecret = () => process.env.GOOGLE_CLIENT_SECRET || "";
export const googleConfigured = () => !!clientId() && !!clientSecret();

export function authUrl(redirectUri: string, state: string) {
  const p = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES,
    access_type: "offline",
    prompt: "consent", // force a refresh_token every time
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH}?${p.toString()}`;
}

type TokenResp = { access_token: string; refresh_token?: string; scope?: string; expires_in?: number };

export async function exchangeCode(code: string, redirectUri: string): Promise<{ email: string }> {
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: clientId(), client_secret: clientSecret(), redirect_uri: redirectUri, grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  const tok = (await res.json()) as TokenResp;
  if (!tok.refresh_token) throw new Error("no refresh_token returned — revoke prior access at myaccount.google.com and reconnect");

  const who = await fetch(USERINFO, { headers: { authorization: `Bearer ${tok.access_token}` } });
  const email = who.ok ? ((await who.json()) as { email?: string }).email || "" : "";

  await db.insert(integrations)
    .values({ provider: "google", refreshToken: tok.refresh_token, email, scope: tok.scope || GOOGLE_SCOPES, updatedAt: new Date() })
    .onConflictDoUpdate({ target: integrations.provider, set: { refreshToken: tok.refresh_token, email, scope: tok.scope || GOOGLE_SCOPES, updatedAt: new Date() } });
  return { email };
}

export async function getConnection() {
  const [row] = await db.select().from(integrations).where(eq(integrations.provider, "google"));
  return row ?? null;
}

export async function disconnectGoogle() {
  await db.delete(integrations).where(eq(integrations.provider, "google"));
}

async function accessToken(): Promise<string> {
  const conn = await getConnection();
  if (!conn) throw new Error("Google not connected");
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId(), client_secret: clientSecret(), refresh_token: conn.refreshToken, grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`token refresh failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as TokenResp).access_token;
}

export type DriveFile = { id: string; name: string; mimeType: string; modifiedTime?: string; createdTime?: string; parents?: string[] };

export async function driveSearch(query: string, pageSize = 100): Promise<DriveFile[]> {
  const token = await accessToken();
  const p = new URLSearchParams({
    q: query,
    fields: "files(id,name,mimeType,modifiedTime,createdTime,parents)",
    pageSize: String(pageSize),
    orderBy: "modifiedTime desc",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  const res = await fetch(`${DRIVE}/files?${p.toString()}`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`drive search failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { files?: DriveFile[] }).files || [];
}

/** Export a Google Doc as plain text. */
export async function readDocText(fileId: string, cap = 20000): Promise<string> {
  const token = await accessToken();
  const res = await fetch(`${DRIVE}/files/${fileId}/export?mimeType=text/plain`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`doc export failed: ${res.status} ${await res.text()}`);
  return (await res.text()).slice(0, cap);
}

/** Export a Google Sheet as CSV text (first/primary sheet). */
export async function readSheetText(fileId: string, cap = 20000): Promise<string> {
  const token = await accessToken();
  const res = await fetch(`${DRIVE}/files/${fileId}/export?mimeType=text/csv`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`sheet export failed: ${res.status} ${await res.text()}`);
  return (await res.text()).slice(0, cap);
}

/** Download an uploaded PDF's bytes and extract its text. */
export async function readPdfText(fileId: string, cap = 20000): Promise<string> {
  const token = await accessToken();
  const res = await fetch(`${DRIVE}/files/${fileId}?alt=media`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`pdf download failed: ${res.status} ${await res.text()}`);
  const data = new Uint8Array(await res.arrayBuffer());
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data });
  try {
    const out = await parser.getText();
    return (out.text || "").replace(/\n{3,}/g, "\n\n").slice(0, cap);
  } catch (e) {
    return `(could not extract PDF text: ${(e as Error).message})`;
  } finally {
    await parser.destroy().catch(() => {});
  }
}

/** Read any supported Drive file as text, dispatching on mime type. */
export async function readFileText(file: { id: string; mimeType: string }, cap = 20000): Promise<string> {
  if (file.mimeType === "application/vnd.google-apps.document") return readDocText(file.id, cap);
  if (file.mimeType === "application/vnd.google-apps.spreadsheet") return readSheetText(file.id, cap);
  if (file.mimeType === "application/pdf") return readPdfText(file.id, cap);
  return `(unsupported file type: ${file.mimeType})`;
}

export const READABLE_MIME = new Set([
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.spreadsheet",
  "application/pdf",
]);

/** Pull a Drive file id out of a share URL (or return the input if it's already an id). */
export function driveIdFromUrl(s: string): string {
  const m = s.match(/[-\w]{25,}/);
  return m ? m[0] : s.trim();
}

export async function fileMeta(id: string): Promise<DriveFile> {
  const token = await accessToken();
  const p = new URLSearchParams({ fields: "id,name,mimeType,modifiedTime,createdTime", supportsAllDrives: "true" });
  const res = await fetch(`${DRIVE}/files/${id}?${p.toString()}`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`file meta failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as DriveFile;
}

/** Read a Drive doc/sheet/pdf by id or share URL, returning its text with a title header. */
export async function readById(idOrUrl: string, cap = 20000): Promise<string> {
  const meta = await fileMeta(driveIdFromUrl(idOrUrl));
  const text = await readFileText(meta, cap);
  return `# ${meta.name}\n\n${text}`;
}
