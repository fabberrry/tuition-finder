"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorMessage, RequestError } from "@/lib/client-api";
type Booking = {
  id: string;
  center_id: string;
  center_name: string;
  batch_name: string;
  teacher_name: string;
  booking_time: string;
  status: string;
};
type Saved = { id: string; name: string; city: string; locality: string };
export function MyLearning() {
  const [tab, setTab] = useState<"bookings" | "saved">("bookings"),
    [bookings, setBookings] = useState<Booking[]>([]),
    [saved, setSaved] = useState<Saved[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [auth, setAuth] = useState(false),
    [attempt, setAttempt] = useState(0),
    [busy, setBusy] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    const c = new AbortController();
    Promise.all([
      api<Booking[]>("/demo-bookings?limit=50", { signal: c.signal }),
      api<Saved[]>("/shortlists?limit=50", { signal: c.signal }),
    ])
      .then(([b, s]) => {
        setBookings(b);
        setSaved(s);
        setError("");
        setAuth(false);
      })
      .catch((e) => {
        if (!c.signal.aborted) {
          setError(errorMessage(e));
          setAuth(e instanceof RequestError && e.status === 401);
        }
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [attempt]);
  async function action(id: string, kind: "cancel" | "remove") {
    setBusy(id);
    setNotice("");
    try {
      if (kind === "cancel") {
        await api(`/demo-bookings/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "cancelled" }),
        });
        setBookings((items) =>
          items.map((b) => (b.id === id ? { ...b, status: "cancelled" } : b)),
        );
        setNotice("Demo cancelled.");
      } else {
        await api(`/shortlists/${id}`, { method: "DELETE" });
        setSaved((items) => items.filter((s) => s.id !== id));
        setNotice("Center removed from your saved list.");
      }
    } catch (e) {
      setNotice(errorMessage(e));
    } finally {
      setBusy("");
    }
  }
  async function logout() {
    setBusy("logout");
    try {
      await api("/auth/logout", { method: "POST" });
      window.location.assign("/");
    } catch (e) {
      setNotice(errorMessage(e));
      setBusy("");
    }
  }
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">ONE STEP CLOSER</span>
        <h1>
          Your learning, <span className="highlight">in one place.</span>
        </h1>
        <p>Keep your favourites close and your next demo closer.</p>
      </div>
      {loading ? (
        <p className="loading" role="status">
          Opening your learning spaceâ€¦
        </p>
      ) : error ? (
        <div className="state-card account-list">
          <h2>
            {auth
              ? "Letâ€™s get you signed in."
              : "We couldnâ€™t load your learning space."}
          </h2>
          <p>
            {auth
              ? "Sign in as a student or parent to see your saved centers and demo bookings."
              : error}
          </p>
          {auth ? (
            <Link
              className="button primary-button"
              href="/login?next=/my-learning"
            >
              Log in â†’
            </Link>
          ) : (
            <button
              className="button primary-button"
              onClick={() => {
                setLoading(true);
                setAttempt((n) => n + 1);
              }}
            >
              Try again
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="account-tabs">
            <button
              className="button outline-button"
              aria-pressed={tab === "bookings"}
              onClick={() => setTab("bookings")}
            >
              My demos ({bookings.length})
            </button>
            <button
              className="button outline-button"
              aria-pressed={tab === "saved"}
              onClick={() => setTab("saved")}
            >
              Saved centers ({saved.length})
            </button>
            <button
              className="button outline-button"
              disabled={!!busy}
              onClick={logout}
            >
              Log out
            </button>
          </div>
          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
          <div className="account-list">
            {tab === "bookings" ? (
              bookings.length === 0 ? (
                <Empty
                  title="Your first demo is a search away."
                  copy="Find a center you like, choose a batch, and book a demo."
                />
              ) : (
                bookings.map((b) => (
                  <article className="panel" key={b.id}>
                    <span className="badge">
                      {b.status.replaceAll("_", " ")}
                    </span>
                    <h2 style={{ marginTop: 16 }}>{b.center_name}</h2>
                    <p>
                      {b.batch_name} Â· {b.teacher_name}
                    </p>
                    <p>
                      {new Date(b.booking_time).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                    <div className="inline-actions">
                      <Link
                        className="text-link"
                        href={`/centers/${b.center_id}`}
                      >
                        View center â†—
                      </Link>
                      {b.status === "booked" && (
                        <button
                          disabled={!!busy}
                          className="button outline-button"
                          onClick={() => {
                            if (window.confirm("Cancel this demo booking?"))
                              void action(b.id, "cancel");
                          }}
                        >
                          {busy === b.id ? "Cancellingâ€¦" : "Cancel demo"}
                        </button>
                      )}
                    </div>
                  </article>
                ))
              )
            ) : saved.length === 0 ? (
              <Empty
                title="Make a little shortlist."
                copy="Save centers you like to keep your options together."
              />
            ) : (
              saved.map((s) => (
                <article className="panel" key={s.id}>
                  <h2>{s.name}</h2>
                  <p>
                    {s.locality}, {s.city}
                  </p>
                  <div className="inline-actions">
                    <Link className="text-link" href={`/centers/${s.id}`}>
                      Explore center â†—
                    </Link>
                    <button
                      disabled={!!busy}
                      className="button outline-button"
                      onClick={() => action(s.id, "remove")}
                    >
                      {busy === s.id ? "Removingâ€¦" : "Remove"}
                    </button>
                  </div>
                </article>
              ))
            )}
            <p>Showing up to 50 recent items.</p>
          </div>
        </>
      )}
    </>
  );
}
function Empty({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="state-card">
      <span className="state-symbol">âœ³</span>
      <h2>{title}</h2>
      <p>{copy}</p>
      <Link className="button primary-button" href="/search">
        Find my tuition â†—
      </Link>
    </div>
  );
}
