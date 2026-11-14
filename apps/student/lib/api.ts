import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "pratham_token";
const memory = new Map<string, string>();

async function getToken() {
  if (Platform.OS === "web") return memory.get(TOKEN_KEY) ?? null;
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string | null) {
  if (Platform.OS === "web") {
    if (token) memory.set(TOKEN_KEY, token);
    else memory.delete(TOKEN_KEY);
    return;
  }
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

function baseUrl() {
  return (
    process.env.EXPO_PUBLIC_API_URL ||
    "http://localhost:3000/api"
  ).replace(/\/$/, "");
}

export async function api<T = unknown>(
  path: string,
  init?: RequestInit & { json?: unknown; auth?: boolean }
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.json !== undefined) headers.set("Content-Type", "application/json");
  if (init?.auth !== false) {
    const token = await getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(`${baseUrl()}${path.startsWith("/") ? path : `/${path}`}`, {
    ...init,
    headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}
