export const API_BASE_URL = process.env.OPENBOX_API_URL ?? 'http://localhost:3000';
export const OPENBOX_API_KEY = process.env.OPENBOX_API_KEY;

export function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    ...extra,
    ...(OPENBOX_API_KEY ? { Authorization: `Bearer ${OPENBOX_API_KEY}` } : {}),
  };
}
