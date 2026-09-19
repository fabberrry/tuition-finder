"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { api, errorMessage } from "@/lib/client-api";
import { Brand } from "@/components/brand";
import { LearningArtwork } from "@/components/learning-artwork";
export function AuthForm({ register = false }: { register?: boolean }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const data = new FormData(e.currentTarget);
    const input = {
      email: String(data.get("email")),
      password: String(data.get("password")),
      ...(register
        ? { fullName: String(data.get("name")), role: String(data.get("role")) }
        : {}),
    };
    try {
      await api(`/auth/${register ? "register" : "login"}`, {
        method: "POST",
        body: JSON.stringify(input),
      });
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.assign(
        next && /^\/(?!\/)/.test(next) && !next.includes("\\")
          ? next
          : "/my-learning",
      );
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }
  return (
    <main id="main-content" className="auth-page">
      <section className="auth-main">
        <div>
          <Brand />
          <h1>
            {register ? (
              <>
                Your next chapter
                <br />
                starts <span className="highlight">here.</span>
              </>
            ) : (
              <>
                Welcome <span className="highlight">back.</span>
              </>
            )}
          </h1>
          <p className="intro">
            {register
              ? "Save your favourites, meet your teachers, and find your kind of learning."
              : "Your next lightbulb moment is waiting. Let’s get you back to it."}
          </p>
          <form onSubmit={submit}>
            {register && (
              <>
                <label className="field">
                  Your full name
                  <input
                    name="name"
                    autoComplete="name"
                    minLength={2}
                    maxLength={150}
                    required
                    placeholder="What should we call you?"
                  />
                </label>
                <label className="field">
                  I’m a
                  <select name="role" defaultValue="student">
                    <option value="student">Student</option>
                    <option value="parent">Parent</option>
                  </select>
                </label>
              </>
            )}
            <label className="field">
              Email address
              <input
                type="email"
                name="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
              />
            </label>
            <label className="field">
              Password
              <input
                type="password"
                name="password"
                autoComplete={register ? "new-password" : "current-password"}
                minLength={register ? 10 : 1}
                maxLength={128}
                required
                placeholder={
                  register ? "At least 10 characters" : "Your password"
                }
              />
            </label>
            {error && (
              <p className="notice" role="alert">
                {error}
              </p>
            )}
            <button className="button primary-button" disabled={busy}>
              {busy
                ? "One moment…"
                : register
                  ? "Create my account ↗"
                  : "Log in ↗"}
            </button>
          </form>
          <p className="auth-switch">
            {register ? "Already learning with us?" : "New to TuitionLens?"}{" "}
            <Link href={register ? "/login" : "/register"}>
              {register ? "Log in" : "Create an account"}
            </Link>
          </p>
          <Link className="text-link" href="/search">
            ← Keep exploring
          </Link>
        </div>
      </section>
      <aside className="auth-side">
        <LearningArtwork />
      </aside>
    </main>
  );
}
