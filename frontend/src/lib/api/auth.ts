import { Effect } from "effect";
import { ApiError } from "@/lib/effect/errors";
import { setAccessToken } from "@/lib/auth/token-store";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type PublicUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
};

export type AuthSession = {
  user: PublicUser;
  accessToken: string;
};

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  accessToken?: string;
};

export function apiRequest<T>(path: string, options: RequestOptions = {}) {
  return Effect.tryPromise({
    try: async () => {
      const response = await fetch(`${apiUrl}${path}`, {
        method: options.method ?? "GET",
        credentials: "include",
        headers: {
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...(options.accessToken
            ? { Authorization: `Bearer ${options.accessToken}` }
            : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      const text = await response.text();
      const data = text ? JSON.parse(text) : null;
      if (!response.ok) {
        throw new ApiError({
          status: response.status,
          message:
            typeof data?.message === "string"
              ? data.message
              : "Authentication request failed",
        });
      }
      return data as T;
    },
    catch: (error) =>
      error instanceof ApiError
        ? error
        : new ApiError({
            status: 0,
            message: "Unable to reach the authentication server",
          }),
  });
}

export const authApi = {
  register: (body: { email: string; password: string; name?: string }) =>
    apiRequest<AuthSession>("/auth/register", { method: "POST", body }).pipe(
      Effect.tap((session) => Effect.sync(() => setAccessToken(session.accessToken))),
    ),
  login: (body: { email: string; password: string }) =>
    apiRequest<AuthSession>("/auth/login", { method: "POST", body }).pipe(
      Effect.tap((session) => Effect.sync(() => setAccessToken(session.accessToken))),
    ),
  refresh: () =>
    apiRequest<AuthSession>("/auth/refresh", { method: "POST", body: {} }).pipe(
      Effect.tap((session) => Effect.sync(() => setAccessToken(session.accessToken))),
    ),
  logout: (refreshToken?: string) =>
    apiRequest<{ message: string }>("/auth/logout", {
      method: "POST",
      body: refreshToken ? { refreshToken } : {},
    }).pipe(Effect.tap(() => Effect.sync(() => setAccessToken(null)))),
  requestTelegramOtp: () =>
    apiRequest<{ challengeId: string; expiresAt: string; deepLink: string }>(
      "/auth/telegram/otp/request",
      { method: "POST", body: {} },
    ),
  telegramOtpStatus: (challengeId: string) =>
    apiRequest<{ status: "waiting" | "sent" | "expired" }>(
      `/auth/telegram/otp/status/${challengeId}`,
    ),
  verifyTelegramOtp: (challengeId: string, code: string) =>
    apiRequest<AuthSession>("/auth/telegram/otp/verify", {
      method: "POST",
      body: { challengeId, code },
    }).pipe(
      Effect.tap((session) =>
        Effect.sync(() => setAccessToken(session.accessToken)),
      ),
    ),
  forgotPassword: (email: string) =>
    apiRequest<{ message: string }>("/auth/password/forgot", {
      method: "POST",
      body: { email },
    }),
  resetPassword: (token: string, password: string) =>
    apiRequest<null>("/auth/password/reset", {
      method: "POST",
      body: { token, password },
    }),
  me: (accessToken: string) =>
    apiRequest<PublicUser>("/auth/me", {
      accessToken,
    }),
};
