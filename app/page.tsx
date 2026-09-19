import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/site-shell";
import { SearchForm } from "@/components/search-form";
import { LearningArtwork } from "@/components/learning-artwork";
const subjects = [
  {
    name: "Mathematics",
    symbol: "π",
    tone: "yellow",
    copy: "Make every problem click.",
  },
  {
    name: "Physics",
    symbol: "↗",
    tone: "lavender",
    copy: "A little curiosity. Big discoveries.",
  },
  {
    name: "Chemistry",
    symbol: "⚗",
    tone: "mint",
    copy: "Find your formula for success.",
  },
  {
    name: "Biology",
    symbol: "✳",
    tone: "peach",
    copy: "Bring your learning to life.",
  },
];
export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <section className="hero container">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="little-sun">✳</span> BIG DREAMS START NEARBY
            </span>
            <h1>
              Your next
              <br />
              “I get it!”
              <br />
              starts <span className="highlight">here.</span>
            </h1>
            <p>
              Find the right tuition, meet a teacher who gets you, and make room
              for your next big win.
            </p>
            <div className="hero-note">
              <span className="check-dot">✓</span> Your subject. Your pace. Your
              neighbourhood.
            </div>
          </div>
          <LearningArtwork />
        </section>
        <section className="container search-section" aria-label="Find tuition">
          <SearchForm />
          <div className="popular">
            <span>A little inspiration:</span>
            {["Class 10", "Class 12", "JEE", "NEET"].map((label) => (
              <Link
                prefetch={false}
                key={label}
                href={`/search?${label.startsWith("Class") ? `classLevel=${label.split(" ")[1]}` : `exam=${label}`}`}
              >
                {label} <span aria-hidden="true">↗</span>
              </Link>
            ))}
          </div>
        </section>
        <div className="trust-strip">
          <div className="container">
            <span>✓ Verified center profiles</span>
            <span>✓ Fees you can compare</span>
            <span>✓ Batch availability</span>
            <span>✓ Try a demo before you decide</span>
          </div>
        </div>
        <section className="container section" id="subjects">
          <div className="section-heading">
            <div>
              <span className="eyebrow">A LITTLE HELP GOES A LONG WAY</span>
              <h2>What’s on your learning list?</h2>
            </div>
            <Link prefetch={false} className="text-link" href="/search">
              Explore all subjects <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <div className="subject-grid">
            {subjects.map((s) => (
              <Link
                prefetch={false}
                className={`subject-card ${s.tone}`}
                href={`/search?subject=${encodeURIComponent(s.name)}`}
                key={s.name}
              >
                <span className="subject-symbol" aria-hidden="true">
                  {s.symbol}
                </span>
                <h3>{s.name}</h3>
                <p>{s.copy}</p>
                <span className="circle-arrow" aria-hidden="true">
                  ↗
                </span>
              </Link>
            ))}
          </div>
        </section>
        <section className="container path-section">
          <div className="path-copy">
            <span className="eyebrow">THERE’S MORE THAN ONE WAY TO GROW</span>
            <h2>
              A learning space
              <br />
              that feels like <span className="highlight">you.</span>
            </h2>
            <p>
              A classroom full of questions, or a lesson from your favourite
              corner. Find a setup that fits your day.
            </p>
            <Link
              prefetch={false}
              className="button dark-button"
              href="/search"
            >
              Find my tuition <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <div className="path-options">
            {[
              [
                "offline",
                "⌂",
                "yellow",
                "Closer to home",
                "Find a tuition center in your neighbourhood.",
              ],
              [
                "online",
                "⌘",
                "lavender",
                "Learn from anywhere",
                "Bring the classroom to your screen.",
              ],
              [
                "hybrid",
                "⇄",
                "mint",
                "The best of both",
                "Mix in-person learning with online lessons.",
              ],
            ].map(([mode, icon, tone, title, copy]) => (
              <Link
                prefetch={false}
                key={mode}
                href={`/search?mode=${mode}`}
                className="path-card"
              >
                <span className={`path-icon ${tone}`} aria-hidden="true">
                  {icon}
                </span>
                <div>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </div>
                <span aria-hidden="true">↗</span>
              </Link>
            ))}
          </div>
        </section>
        <section className="how-section" id="how-it-works">
          <div className="container section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">LESS GUESSWORK. MORE LEARNING.</span>
                <h2>Your right fit, in three little steps.</h2>
              </div>
              <span className="handwritten">You’ve got this! ✳</span>
            </div>
            <div className="steps">
              {[
                [
                  "01",
                  "Find your options",
                  "Search by location, class, and subject. Start with what matters to you.",
                ],
                [
                  "02",
                  "Get to know them",
                  "Explore teachers, compare fees, and check which batches have space.",
                ],
                [
                  "03",
                  "Give it a try",
                  "Book a demo, ask your questions, and decide if it feels right.",
                ],
              ].map(([n, t, c]) => (
                <article key={n}>
                  <span className="step-number">{n}</span>
                  <h3>{t}</h3>
                  <p>{c}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="container section faq-section">
          <div>
            <span className="eyebrow">GOOD QUESTIONS DESERVE GOOD ANSWERS</span>
            <h2>
              A few things
              <br />
              you might be wondering.
            </h2>
            <p>Finding tuition should feel simple.</p>
          </div>
          <div className="faq-list">
            {[
              [
                "How do I find the right tuition?",
                "Start with your city, class, and subject. Compare the fees, batch timings, teacher profiles, and available seats on each center’s page.",
              ],
              [
                "Can I try a class before enrolling?",
                "Yes. Sign in as a student or parent, choose an available batch, and book a demo from the center’s profile. Your bookings stay in My learning.",
              ],
              [
                "Can parents book a demo?",
                "Yes. Create a parent account to save centers and book demos for your child.",
              ],
              [
                "Do I pay my tuition fees here?",
                "No. TuitionLens helps you discover centers and book demos. Discuss enrollment and fee payments directly with your chosen center.",
              ],
            ].map(([q, a]) => (
              <details key={q} name="faq">
                <summary>
                  {q}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="container">
          <div className="final-cta">
            <div>
              <span className="eyebrow">SMALL STEPS. BRIGHT FUTURES.</span>
              <h2>
                Let’s find your
                <br />
                kind of learning.
              </h2>
            </div>
            <Link
              prefetch={false}
              href="/search"
              className="button dark-button"
            >
              Explore tuition near you <span aria-hidden="true">↗</span>
            </Link>
            <span className="cta-star" aria-hidden="true">
              ✳
            </span>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
