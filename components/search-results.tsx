"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, Center, errorMessage, money } from "@/lib/client-api";
const filterKeys = [
  "city",
  "locality",
  "subject",
  "classLevel",
  "board",
  "exam",
  "mode",
  "timing",
  "vacancy",
  "maxFee",
  "minRating",
];
export function SearchResults({ params }: { params: Record<string, string> }) {
  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const page = Math.max(0, Math.floor(Number(params.page) || 0));
  const query = new URLSearchParams(
    Object.entries(params).filter(([k, v]) => filterKeys.includes(k) && v),
  );
  query.set("limit", "12");
  query.set("offset", String(page * 12));
  const queryString = query.toString();
  useEffect(() => {
    const controller = new AbortController();
    api<Center[]>(`/search/centers?${queryString}`, {
      signal: controller.signal,
    })
      .then((data) => {
        setCenters(data);
        setError("");
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorMessage(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [queryString, attempt]);
  function pageUrl(n: number) {
    const p = new URLSearchParams(params);
    p.set("page", String(n));
    return `/search?${p}`;
  }
  return (
    <div className="results-layout">
      <form action="/search" className="filter-panel">
        <h2>Make it your fit</h2>
        {["city", "subject", "classLevel"].map(
          (k) =>
            params[k] && (
              <input type="hidden" key={k} name={k} value={params[k]} />
            ),
        )}
        <div className="filter-fields">
          <label className="field">
            Neighbourhood
            <input
              name="locality"
              defaultValue={params.locality}
              placeholder="Any locality"
              maxLength={100}
            />
          </label>
          <label className="field">
            Board
            <select name="board" defaultValue={params.board || ""}>
              <option value="">Any board</option>
              <option>CBSE</option>
              <option>ICSE</option>
              <option>State Board</option>
            </select>
          </label>
          <label className="field">
            Exam
            <select name="exam" defaultValue={params.exam || ""}>
              <option value="">Any exam</option>
              <option>JEE</option>
              <option>NEET</option>
              <option>CUET</option>
            </select>
          </label>
          <label className="field">
            Learning mode
            <select name="mode" defaultValue={params.mode || ""}>
              <option value="">Any mode</option>
              <option value="offline">In person</option>
              <option value="online">Online</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </label>
          <label className="field">
            Monthly budget (₹)
            <input
              name="maxFee"
              type="number"
              min="0"
              defaultValue={params.maxFee}
              placeholder="No maximum"
            />
          </label>
          <label className="field">
            Time of day
            <select name="timing" defaultValue={params.timing || ""}>
              <option value="">Any time</option>
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="evening">Evening</option>
            </select>
          </label>
          <label className="field">
            Minimum rating
            <select name="minRating" defaultValue={params.minRating || ""}>
              <option value="">Any rating</option>
              <option value="4">4 stars & up</option>
              <option value="3">3 stars & up</option>
            </select>
          </label>
          <label className="field">
            Availability
            <select name="vacancy" defaultValue={params.vacancy || ""}>
              <option value="">All batches</option>
              <option value="true">Seats available</option>
            </select>
          </label>
        </div>
        <button className="button primary-button">Apply filters</button>
        <Link className="text-link" href="/search">
          Reset all filters ↺
        </Link>
      </form>
      <section aria-label="Tuition results" aria-busy={loading}>
        <div className="results-heading">
          <h2>
            {params.city
              ? `Tuition in ${params.city}`
              : "Explore tuition centers"}
          </h2>
          <span className="badge">✓ Verified profiles</span>
        </div>
        {loading ? (
          <p className="loading" role="status">
            Finding your options…
          </p>
        ) : error ? (
          <div className="state-card" role="alert">
            <span className="state-symbol">☁</span>
            <h3>Let’s try that again</h3>
            <p>{error}</p>
            <button
              className="button primary-button"
              onClick={() => {
                setLoading(true);
                setAttempt((v) => v + 1);
              }}
            >
              Retry search
            </button>
          </div>
        ) : centers.length === 0 ? (
          <div className="state-card">
            <span className="state-symbol">⌕</span>
            <h3>A little wider might do it.</h3>
            <p>
              No tuition centers match these filters yet. Try another city,
              subject, or a higher budget.
            </p>
            <Link className="button primary-button" href="/search">
              Explore all tuition
            </Link>
          </div>
        ) : (
          <>
            <div className="results-list">
              {centers.map((c) => (
                <article className="center-card" key={c.id}>
                  <div className="center-monogram" aria-hidden="true">
                    {c.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="center-content">
                    <h3>
                      <Link href={`/centers/${c.id}`}>{c.name}</Link>
                    </h3>
                    <p>⌖ {[c.locality, c.city].filter(Boolean).join(", ")}</p>
                    <div className="chips">
                      <span className="chip">{c.subject}</span>
                      <span className="chip">
                        Class {c.class_level} · {c.board}
                      </span>
                      <span className="chip">
                        {c.mode === "offline" ? "In person" : c.mode}
                      </span>
                    </div>
                    <p>
                      {c.total_reviews > 0
                        ? `★ ${Number(c.average_rating).toFixed(1)} · ${c.total_reviews} reviews`
                        : "New here · No reviews yet"}{" "}
                      ·{" "}
                      {c.vacant_seats > 0
                        ? `${c.vacant_seats} seats available`
                        : "Batch full"}
                    </p>
                    <div className="card-bottom">
                      <div>
                        <strong>{money(c.monthly_fee)}</strong>
                        {c.monthly_fee !== null && <small> / month</small>}
                      </div>
                      <Link
                        className="button outline-button"
                        href={`/centers/${c.id}`}
                      >
                        Meet your tuition ↗
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
        {!loading && !error && (page > 0 || centers.length === 12) && (
          <nav className="pagination" aria-label="Results pages">
            {page > 0 && (
              <Link className="button outline-button" href={pageUrl(page - 1)}>
                ← Previous
              </Link>
            )}
            <span>Page {page + 1}</span>
            {centers.length === 12 && (
              <Link className="button outline-button" href={pageUrl(page + 1)}>
                Next →
              </Link>
            )}
          </nav>
        )}
      </section>
    </div>
  );
}
