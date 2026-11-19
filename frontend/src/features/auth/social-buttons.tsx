"use client";

import { useEffect, useState } from "react";
import { Effect } from "effect";
import { authApi } from "@/lib/api/auth";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

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
        <span className="mr-2 grid h-5 w-5 place-items-center rounded-full border border-zinc-200 text-xs font-bold text-indigo-600">G</span>
        Google
      </a>
      <a
        href={`${apiUrl}/auth/facebook`}
        className="flex h-12 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 font-semibold text-zinc-800 shadow-sm hover:border-zinc-300 hover:bg-zinc-50"
      >
        <span className="mr-2 grid h-5 w-5 place-items-center rounded-full bg-blue-600 text-xs font-bold text-white">f</span>
        Facebook
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
          <span className="mr-2 grid h-5 w-5 place-items-center rounded-full bg-sky-500 text-sm text-white">⌁</span>
          Continue with Telegram
        </button>
      )}
    </div>
  );
}
