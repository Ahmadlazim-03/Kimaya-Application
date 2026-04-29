/**
 * WAHA (WhatsApp HTTP API) Client
 * Communicates with the self-hosted WAHA NoWeb container
 */

const WAHA_API_URL = process.env.WAHA_API_URL || "http://localhost:3001";
const WAHA_API_KEY = process.env.WAHA_API_KEY || "";

interface WahaRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: Record<string, unknown>;
}

async function wahaFetch<T = unknown>(
  endpoint: string,
  options: WahaRequestOptions = {}
): Promise<T> {
  const { method = "GET", body } = options;

  const res = await fetch(`${WAHA_API_URL}${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": WAHA_API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WAHA API error (${res.status}): ${text}`);
  }

  return res.json() as Promise<T>;
}

// ---- Session Management ----

export async function getSessionStatus(session = "default") {
  return wahaFetch(`/api/sessions/${session}`);
}

export async function startSession(session = "default") {
  return wahaFetch("/api/sessions/start", {
    method: "POST",
    body: { name: session },
  });
}

export async function getQRCode(session = "default") {
  return wahaFetch(`/api/${session}/auth/qr`);
}

// ---- Messaging ----

export async function sendText(
  chatId: string,
  text: string,
  session = "default"
) {
  return wahaFetch(`/api/sendText`, {
    method: "POST",
    body: {
      session,
      chatId,
      text,
    },
  });
}

export async function sendImage(
  chatId: string,
  imageUrl: string,
  caption: string,
  session = "default"
) {
  return wahaFetch(`/api/sendImage`, {
    method: "POST",
    body: {
      session,
      chatId,
      file: { url: imageUrl },
      caption,
    },
  });
}

export async function sendFile(
  chatId: string,
  fileUrl: string,
  filename: string,
  caption: string,
  session = "default"
) {
  return wahaFetch(`/api/sendFile`, {
    method: "POST",
    body: {
      session,
      chatId,
      file: { url: fileUrl },
      fileName: filename,
      caption,
    },
  });
}

// ---- Helpers ----

/**
 * Format phone number to WhatsApp chat ID
 * e.g. "+6281234567890" → "6281234567890@c.us"
 */
export function phoneToWaChatId(phone: string): string {
  const cleaned = phone.replace(/[^0-9]/g, "");
  return `${cleaned}@c.us`;
}

/**
 * Build message from template with variable substitution
 * e.g. "Hai {nama}, absensi kamu {status}" → "Hai Ahmad, absensi kamu Tepat Waktu"
 */
export function buildMessage(
  template: string,
  variables: Record<string, string>
): string {
  let message = template;
  for (const [key, value] of Object.entries(variables)) {
    message = message.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return message;
}

// ---- Reminder Sender ----

export async function sendReminder(
  phone: string,
  template: string,
  variables: Record<string, string>,
  session = "default"
) {
  const chatId = phoneToWaChatId(phone);
  const text = buildMessage(template, variables);
  return sendText(chatId, text, session);
}

export default {
  getSessionStatus,
  startSession,
  getQRCode,
  sendText,
  sendImage,
  sendFile,
  sendReminder,
  phoneToWaChatId,
  buildMessage,
};
