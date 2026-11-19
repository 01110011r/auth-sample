"use client";

import { useEffect, useState } from "react";
import { Effect } from "effect";
import { authApi } from "@/lib/api/auth";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M21.35 12.27c0-.72-.06-1.42-.18-2.09H12v3.96h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.7 2.91-4.2 2.91-7.26Z"
      />
      <path
        fill="#34A853"
        d="M12 21.75c2.63 0 4.84-.87 6.45-2.37l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.3v2.53A9.74 9.74 0 0 0 12 21.75Z"
      />
      <path
        fill="#FBBC05"
        d="M6.54 13.82a5.85 5.85 0 0 1 0-3.64V7.65H3.3a9.75 9.75 0 0 0 0 8.7l3.24-2.53Z"
      />
      <path
        fill="#EA4335"
        d="M12 6.15c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.25 14.63 2.25 12 2.25a9.74 9.74 0 0 0-8.7 5.4l3.24 2.53C7.31 7.87 9.46 6.15 12 6.15Z"
      />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M13.5 21v-8h2.7l.4-3h-3.1V8.1c0-.87.24-1.46 1.52-1.46h1.63V3.96c-.28-.04-1.24-.12-2.35-.12-2.33 0-3.93 1.42-3.93 4.03V10H7.75v3h2.62v8h3.13Z"
      />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="m21.7 4.3-3.1 14.62c-.23 1.03-.84 1.29-1.7.8l-4.68-3.45-2.26 2.18c-.25.25-.46.46-.94.46l.34-4.77 8.68-7.84c.38-.34-.08-.53-.59-.19L6.72 12.9l-4.66-1.46c-1.01-.32-1.03-1.01.21-1.5L20.5 3.38c.83-.3 1.56.19 1.2.92Z"
      />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M15.5 4a4.5 4.5 0 0 0-4.2 6.12L3 18.42V21h2.58l1.5-1.5h2v-2h2v-2h1.38l1.42-1.42A4.5 4.5 0 1 0 15.5 4Zm0 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z"
      />
    </svg>
  );
}

export function SocialButtons() {
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [telegramError, setTelegramError] = useState("");
  const [telegramStatus, setTelegramStatus] =
    useState("Open Telegram and start the bot.");

  useEffect(() => {
    if (!challengeId) return;
    const interval = window.setInterval(() => {
      void Effect.runPromise(authApi.telegramOtpStatus(challengeId)).then(
        (status) => {
          if (status.status === "sent") {
            setTelegramStatus("Enter the 6-digit code sent to Telegram.");
          } else if (status.status === "expired") {
            setTelegramStatus("This login code has expired.");
          }
        },
      );
    }, 1500);
    return () => window.clearInterval(interval);
  }, [challengeId]);

  async function openTelegramOtp() {
    setTelegramError("");
    const popup = window.open("about:blank", "_blank");
    try {
      const challenge = await Effect.runPromise(authApi.requestTelegramOtp());
      setChallengeId(challenge.challengeId);
      setTelegramStatus("Open Telegram and start the bot.");
      if (popup) {
        popup.location.href = challenge.deepLink;
      } else {
        window.location.assign(challenge.deepLink);
      }
    } catch (error) {
      popup?.close();
      setTelegramError(
        error instanceof Error ? error.message : "Could not start Telegram login",
      );
    }
  }

  async function verifyTelegramOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTelegramError("");
    await Effect.runPromise(
      authApi.verifyTelegramOtp(challengeId!, code),
    ).then(
      () => window.location.assign("/"),
      (error) =>
        setTelegramError(
          error instanceof Error
            ? error.message
            : "Telegram login code is invalid",
        ),
    );
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
        <span className="h-px flex-1 bg-zinc-200" />
        Or continue with
        <span className="h-px flex-1 bg-zinc-200" />
      </div>
      <a
        href={`${apiUrl}/auth/google`}
        className="flex h-12 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 font-semibold text-zinc-800 shadow-sm hover:border-zinc-300 hover:bg-zinc-50"
      >
        <span className="mr-2 grid h-5 w-5 place-items-center">
          <GoogleIcon />
        </span>
        Google
      </a>
      <a
        href={`${apiUrl}/auth/facebook`}
        className="flex h-12 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 font-semibold text-zinc-800 shadow-sm hover:border-zinc-300 hover:bg-zinc-50"
      >
        <span className="mr-2 grid h-5 w-5 place-items-center rounded-full bg-[#1877F2] text-white">
          <FacebookIcon />
        </span>
        Facebook
      </a>
      <a
        href={`${apiUrl}/auth/telegram/oidc`}
        className="flex h-12 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 font-semibold text-zinc-800 shadow-sm hover:border-zinc-300 hover:bg-zinc-50"
      >
        <span className="mr-2 grid h-5 w-5 place-items-center rounded-full bg-[#229ED9] text-white">
          <TelegramIcon />
        </span>
        Telegram
      </a>
      {challengeId ? (
        <form className="flex flex-col gap-2" onSubmit={verifyTelegramOtp}>
          <label className="text-sm font-medium text-zinc-700">
            Telegram login code
            <input
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              required
              className="mt-2 h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-center text-lg font-semibold tracking-[0.35em] outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              placeholder="000000"
            />
          </label>
          <p className="text-xs text-zinc-500">{telegramStatus}</p>
          {telegramError && (
            <p role="alert" className="text-xs text-red-600">
              {telegramError}
            </p>
          )}
          <button
            type="submit"
            className="h-11 rounded-xl bg-zinc-950 px-4 font-semibold text-white"
          >
            Verify Telegram code
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={openTelegramOtp}
          className="flex h-12 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 font-semibold text-zinc-800 shadow-sm hover:border-zinc-300 hover:bg-zinc-50"
        >
          <span className="mr-2 grid h-5 w-5 place-items-center rounded-full bg-zinc-700 text-white">
            <KeyIcon />
          </span>
          Continue with Telegram
        </button>
      )}
    </div>
  );
}
