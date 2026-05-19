import type { IolTokenResponse } from "./types";

const TOKEN_URL = "/api/iol/token";
const STORAGE_KEYS = {
  username: "iol_username",
  password: "iol_password",
  accessToken: "iol_access_token",
  refreshToken: "iol_refresh_token",
  expiresAt: "iol_expires_at",
} as const;

class IolAuthManager {
  private static instance: IolAuthManager;
  private refreshPromise: Promise<void> | null = null;

  static getInstance(): IolAuthManager {
    if (!IolAuthManager.instance) {
      IolAuthManager.instance = new IolAuthManager();
    }
    return IolAuthManager.instance;
  }

  getCredentials(): { username: string; password: string } | null {
    if (typeof window === "undefined") return null;
    const username = localStorage.getItem(STORAGE_KEYS.username);
    const password = localStorage.getItem(STORAGE_KEYS.password);
    if (!username || !password) return null;
    return { username, password };
  }

  setCredentials(username: string, password: string): void {
    localStorage.setItem(STORAGE_KEYS.username, username);
    localStorage.setItem(STORAGE_KEYS.password, password);
  }

  hasCredentials(): boolean {
    return this.getCredentials() !== null;
  }

  clearSession(): void {
    Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
  }

  async getAccessToken(): Promise<string> {
    const token = localStorage.getItem(STORAGE_KEYS.accessToken);
    const expiresAt = Number(localStorage.getItem(STORAGE_KEYS.expiresAt) ?? 0);
    const fiveMinFromNow = Date.now() + 5 * 60 * 1000;

    if (token && expiresAt > fiveMinFromNow) {
      return token;
    }

    const refreshToken = localStorage.getItem(STORAGE_KEYS.refreshToken);
    if (refreshToken && expiresAt > Date.now()) {
      if (!this.refreshPromise) {
        this.refreshPromise = this.doRefresh(refreshToken).finally(() => {
          this.refreshPromise = null;
        });
      }
      await this.refreshPromise;
      return localStorage.getItem(STORAGE_KEYS.accessToken)!;
    }

    if (!this.refreshPromise) {
      this.refreshPromise = this.doAuthenticate().finally(() => {
        this.refreshPromise = null;
      });
    }
    await this.refreshPromise;
    return localStorage.getItem(STORAGE_KEYS.accessToken)!;
  }

  private async doAuthenticate(): Promise<void> {
    const creds = this.getCredentials();
    if (!creds) throw new Error("No hay credenciales de IOL guardadas");

    const body = new URLSearchParams({
      grant_type: "password",
      username: creds.username,
      password: creds.password,
    });

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.status.toString());
      throw new Error(`IOL auth failed: ${text}`);
    }

    const data: IolTokenResponse = await res.json();
    this.storeTokens(data);
  }

  private async doRefresh(refreshToken: string): Promise<void> {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });

    try {
      const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      if (!res.ok) throw new Error("Refresh failed");
      const data: IolTokenResponse = await res.json();
      this.storeTokens(data);
    } catch {
      await this.doAuthenticate();
    }
  }

  clearTokens(): void {
    localStorage.removeItem(STORAGE_KEYS.accessToken);
    localStorage.removeItem(STORAGE_KEYS.refreshToken);
    localStorage.removeItem(STORAGE_KEYS.expiresAt);
  }

  private storeTokens(data: IolTokenResponse): void {
    const expiresAt = Date.now() + data.expires_in * 1000;
    localStorage.setItem(STORAGE_KEYS.accessToken, data.access_token);
    localStorage.setItem(STORAGE_KEYS.refreshToken, data.refresh_token);
    localStorage.setItem(STORAGE_KEYS.expiresAt, String(expiresAt));
  }
}

export const iolAuth = IolAuthManager.getInstance();
