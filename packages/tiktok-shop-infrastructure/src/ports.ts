import type { ExternalConnection } from "@gmvgang/platform-foundation";

export interface TikTokShopConnectionResolver {
  getConnection(connectionId: string): Promise<ExternalConnection | null>;
}

export interface SecretResolver {
  getSecret(secretRef: string): Promise<string>;
}

export interface TikTokShopAppConfig {
  appKey: string;
  appSecretRef: string;
  baseUrl?: string;
}

export interface TikTokHttpRequest {
  method: "GET" | "POST";
  url: string;
  headers: Readonly<Record<string, string>>;
  body?: string;
}

export interface TikTokHttpResponse {
  status: number;
  body: string;
  headers?: Readonly<Record<string, string>>;
}

export interface TikTokHttpTransport {
  send(request: TikTokHttpRequest): Promise<TikTokHttpResponse>;
}

export interface TikTokClock {
  unixSeconds(): number;
}

export interface TikTokSleeper {
  sleep(milliseconds: number): Promise<void>;
}

export const systemTikTokClock: TikTokClock = {
  unixSeconds: () => Math.floor(Date.now() / 1000)
};

export const systemTikTokSleeper: TikTokSleeper = {
  sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
};
