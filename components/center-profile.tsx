"use client";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { api, errorMessage, money, RequestError } from "@/lib/client-api";
type Batch = {
  id: string;
  batch_name: string;
  subject: string;
  teacher_name: string;
  class_level: string;
  board: string;
  start_time: string;
  end_time: string;
  days_of_week: string[];
  monthly_fee: string | null;
  vacant_seats: number;
  mode: string;
};
type Profile = {
  id: string;
  name: string;
  description: string;
  address: string;
  city: string;
  locality: string;
  teachers: {
    id: string;
    name: string;
    qualification: string;
    experience_years: number;
    bio: string;
    subjects: string[];
  }[];
  batches: Batch[];
  videos: {
    id: string;
    title: string;
    teacher_name: string;
    video_url: string;
  }[];
  reviews: {
    id: string;
    rating: number;
    review_text: string;
    reviewer: string;
  }[];
};
function safeUrl(value: string) {
  try {
    const u = new URL(value);
    return ["https:", "http:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}
export function CenterProfile({ id }: { id: string }) {
  const [center, setCenter] = useState<Profile | null>(null),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  const [batch, setBatch] = useState(""),
    [message, setMessage] = useState(""),
    [success, setSuccess] = useState(false),
    [busy, setBusy] = useState(false),
    [saving, setSaving] = useState(false),
    [saved, setSaved] = useState(false),
    [saveMessage, setSaveMessage] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    api<Profile>(`/centers/${id}`, { signal: controller.signal })
      .then((c) => {
        setCenter(c);
        setError("");
        setBatch(c.batches.find((b) => b.vacant_seats > 0)?.id || "");
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorMessage(e));
      });
    return () => controller.abort();
  }, [id, attempt]);
  async function save() {
    setSaving(true);
    setSaveMessage("");
    try {
      await api("/shortlists", {
        method: "POST",
        body: JSON.stringify({ centerId: id }),
      });
      setSaved(true);
      setSaveMessage("Saved to My learning.");
    } catch (e) {
      setSaveMessage(
        e instanceof RequestError && e.status === 401
          ? "Log in as a student or parent to save this center."
          : errorMessage(e),
      );
    } finally {
      setSaving(false);
    }
  }
  async function book(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setSuccess(false);
    const data = new FormData(e.currentTarget);
    try {
      const time = new Date(String(data.get("time")));
      if (time.getTime() <= Date.now())
        throw new Error("Choose a future date and time.");
      await api("/demo-bookings", {
        method: "POST",
        body: JSON.stringify({
          centerId: id,
          batchId: batch,
          bookingTime: time.toISOString(),
          contactPhone: String(data.get("phone")),
        }),
      });
      setSuccess(true);
      setMessage("Your demo is booked! View the details in My learning.");
    } catch (err) {
      setMessage(
        err instanceof RequestError && err.status === 401
          ? "Please log in as a student or parent before booking a demo."
          : errorMessage(err),
      );
    } finally {
      setBusy(false);
    }
  }
  if (error)
    return (
      <div className="section">
        <div className="state-card" role="alert">
          <h1>We couldn’t open this center.</h1>
          <p>{error}</p>
          <button
            className="button primary-button"
            onClick={() => {
              setError("");
              setAttempt((n) => n + 1);
            }}
          >
            Try again
          </button>
          <Link className="text-link" href="/search">
            Back to search →
          </Link>
        </div>
      </div>
    );
  if (!center)
    return (
      <p className="loading" role="status">
        Getting to know your tuition…
      </p>
    );
  return (
    <>
      <div className="page-heading">
        <Link className="text-link" href="/search">
          ← Back to tuition
        </Link>
        <div className="profile-header">
          <div className="center-monogram" aria-hidden="true">
            {center.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <span className="badge">✓ Verified center</span>
            <h1>{center.name}</h1>
            <p>
              ⌖{" "}
              {[center.address, center.locality, center.city]
                .filter(Boolean)
                .join(", ")}
            </p>
          </div>
        </div>
      </div>
      <div className="profile-layout">
        <div>
          <section className="panel">
            <h2>A place to grow</h2>
            <p>
              {center.description ||
                "Explore this center’s teachers and batches to find your fit."}
            </p>
            <button
              disabled={saving || saved}
              className="button outline-button"
              onClick={save}
            >
              {saved ? "✓ Saved" : saving ? "Saving…" : "♡ Save this center"}
            </button>
            {saveMessage && (
              <p role="status">
                {saveMessage}{" "}
                {!saved && (
                  <Link
                    className="text-link"
                    href={`/login?next=${encodeURIComponent(`/centers/${id}`)}`}
                  >
                    Log in →
                  </Link>
                )}
              </p>
            )}
          </section>
          <section className="panel">
            <h2>Meet your teachers</h2>
            {center.teachers.length === 0 ? (
              <p>Teacher profiles will appear here when available.</p>
            ) : (
              center.teachers.map((t) => (
                <article className="detail-row" key={t.id}>
                  <h3>{t.name}</h3>
                  <p>
                    {t.qualification}{" "}
                    {t.experience_years
                      ? `· ${t.experience_years} years of experience`
                      : ""}
                  </p>
                  <div className="chips">
                    {t.subjects.map((s) => (
                      <span className="chip" key={s}>
                        {s}
                      </span>
                    ))}
                  </div>
                  {t.bio && <p>{t.bio}</p>}
                </article>
              ))
            )}
          </section>
          <section className="panel">
            <h2>Find your batch</h2>
            {center.batches.length === 0 ? (
              <p>No active batches at the moment. Check back soon.</p>
            ) : (
              center.batches.map((b) => (
                <article className="detail-row" key={b.id}>
                  <h3>{b.batch_name}</h3>
                  <p>
                    {b.subject} · Class {b.class_level} · {b.board} · {b.mode}
                  </p>
                  <p>
                    {b.teacher_name} · {b.start_time?.slice(0, 5)}–
                    {b.end_time?.slice(0, 5)}
                    {b.days_of_week?.length
                      ? ` · ${b.days_of_week.join(", ")}`
                      : ""}
                  </p>
                  <div className="card-bottom">
                    <div>
                      <strong>{money(b.monthly_fee)}</strong>
                      {b.monthly_fee !== null && <small> / month</small>}
                      <p>
                        {b.vacant_seats > 0
                          ? `${b.vacant_seats} seats available`
                          : "Currently full"}
                      </p>
                    </div>
                    {b.vacant_seats > 0 && (
                      <a
                        className="button outline-button"
                        href="#book-demo"
                        onClick={() => {
                          setBatch(b.id);
                          setSuccess(false);
                          setMessage("");
                        }}
                      >
                        Try this batch ↗
                      </a>
                    )}
                  </div>
                </article>
              ))
            )}
          </section>
          {center.videos.length > 0 && (
            <section className="panel">
              <h2>See their teaching style</h2>
              {center.videos.map((v) => {
                const url = safeUrl(v.video_url);
                return (
                  url && (
                    <a
                      className="video-link"
                      key={v.id}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span>
                        ▷ {v.title}
                        <p>{v.teacher_name}</p>
                      </span>
                      <span>Watch ↗</span>
                    </a>
                  )
                );
              })}
            </section>
          )}
          <section className="panel">
            <h2>Student experiences</h2>
            {center.reviews.length === 0 ? (
              <p>
                No reviews yet. Reviews appear after a verified demo attendance
                and moderation.
              </p>
            ) : (
              center.reviews.map((r) => (
                <article className="detail-row" key={r.id}>
                  <span className="badge">★ {r.rating} / 5</span>
                  <p className="review-quote">“{r.review_text}”</p>
                  <strong>{r.reviewer}</strong>
                </article>
              ))
            )}
          </section>
        </div>
        <aside className="panel booking-panel" id="book-demo">
          <span className="eyebrow">SEE IF IT CLICKS</span>
          <h2>Try a demo class.</h2>
          <p>A small first step towards your next big win.</p>
          {center.batches.some((b) => b.vacant_seats > 0) ? (
            <form onSubmit={book}>
              <label className="field">
                Choose your batch
                <select
                  required
                  value={batch}
                  onChange={(e) => {
                    setBatch(e.target.value);
                    setSuccess(false);
                    setMessage("");
                  }}
                >
                  {center.batches
                    .filter((b) => b.vacant_seats > 0)
                    .map((b) => (
                      <option value={b.id} key={b.id}>
                        {b.batch_name} · {b.subject}
                      </option>
                    ))}
                </select>
              </label>
              <label className="field">
                Preferred date & time
                <input type="datetime-local" name="time" required />
              </label>
              <label className="field">
                Contact phone
                <input
                  type="tel"
                  name="phone"
                  autoComplete="tel"
                  placeholder="Your contact number"
                  minLength={7}
                  maxLength={20}
                  pattern="\+?[0-9][0-9\s\-]{6,19}"
                  required
                />
              </label>
              <button
                className="button primary-button"
                disabled={busy || success}
              >
                {busy
                  ? "Booking your demo…"
                  : success
                    ? "✓ Demo booked"
                    : "Book my demo ↗"}
              </button>
              {message && (
                <div
                  role={success ? "status" : "alert"}
                  className={`notice ${success ? "success" : ""}`}
                >
                  {message}
                </div>
              )}
              <Link
                className="text-link"
                href={
                  success
                    ? "/my-learning"
                    : `/login?next=${encodeURIComponent(`/centers/${id}`)}`
                }
              >
                {success
                  ? "View my bookings →"
                  : "Already have an account? Log in →"}
              </Link>
            </form>
          ) : (
            <p>
              No demo seats are currently available. Try another center or check
              back later.
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
