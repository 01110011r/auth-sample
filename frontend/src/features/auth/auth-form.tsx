"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

type AuthFormProps = {
  mode: "login" | "register";
  onSubmit: (values: { email: string; password: string; name?: string }) => Promise<void>;
};

export function AuthForm({ mode, onSubmit }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onSubmit({
        email,
        password,
        ...(mode === "register" ? { name } : {}),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-4">
      {mode === "register" && (
        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
          Name
          <input
            className="h-12 rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-base text-zinc-950 outline-none placeholder:text-zinc-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={100}
            placeholder="Your name"
          />
        </label>
      )}
      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
        Email
        <input
          type="email"
          required
          className="h-12 rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-base text-zinc-950 outline-none placeholder:text-zinc-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
        <span>Password</span>
        <input
          type="password"
          required
          minLength={mode === "register" ? 8 : 1}
          maxLength={72}
          className="h-12 rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-base text-zinc-950 outline-none placeholder:text-zinc-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="At least 8 characters"
        />
      </label>
      {error && (
        <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="mt-1 h-12 rounded-xl bg-zinc-950 px-4 font-semibold text-white shadow-lg shadow-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
      </button>
      {mode === "login" ? (
        <Link className="text-center text-sm font-medium text-zinc-500 hover:text-zinc-900" href="/forgot-password">
          Forgot password?
        </Link>
      ) : (
        <Link className="text-sm text-zinc-600 underline" href="/login">
          Already have an account?
        </Link>
      )}
    </form>
  );
}
