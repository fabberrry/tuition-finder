export default function AuthArtwork() {
  return (
    <div className="relative h-full min-h-screen overflow-hidden bg-[#FFD84D]">
      {/* Background shapes */}
      <div className="absolute -right-28 -top-28 h-80 w-80 rounded-full bg-[#FFB75E]" />

      <div className="absolute -bottom-28 -left-24 h-80 w-80 rounded-full bg-[#A7DDD2]" />

      <div className="absolute right-16 top-40 h-28 w-28 rotate-12 rounded-[34px] bg-[#F78B75]" />

      <div className="absolute left-16 top-24 h-16 w-16 -rotate-12 rounded-2xl border-[10px] border-[#302A18]/10" />

      <div className="relative z-10 flex h-full min-h-screen flex-col justify-between p-10 lg:p-16">
        <div className="flex justify-end">
          <div className="rounded-full border border-black/10 bg-white/45 px-4 py-2 text-sm font-semibold text-[#5E4D14] backdrop-blur-md">
            ✦ Learn · Discover · Grow
          </div>
        </div>

        <div>
          <h2 className="max-w-md text-4xl font-bold leading-tight tracking-tight text-[#2C2819] lg:text-5xl">
            Learning should feel easier to find.
          </h2>

          <div className="relative mt-10 h-[390px]">
            {/* Main white board */}
            <div className="absolute left-0 top-6 w-[75%] -rotate-3 rounded-[28px] bg-[#FFFDF4] p-7 shadow-[0_25px_50px_rgba(78,62,10,0.16)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#99917F]">
                    Recommended
                  </p>

                  <h3 className="mt-2 text-xl font-bold text-[#29251B]">
                    Mathematics
                  </h3>
                </div>

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF0B0] text-xl font-bold">
                  π
                </div>
              </div>

              <div className="mt-7 space-y-3">
                <div className="rounded-2xl bg-[#F5F2E8] p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-[#383329]">
                        Bright Academy
                      </p>

                      <p className="mt-1 text-xs text-[#928C80]">
                        Class 11–12 · 1.4 km
                      </p>
                    </div>

                    <span className="rounded-full bg-[#DDF3ED] px-3 py-1 text-xs font-bold text-[#35766B]">
                      4.8 ★
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl bg-[#FFF3C4] p-4">
                  <p className="text-sm font-semibold text-[#735713]">
                    12 new tutors near you
                  </p>
                </div>
              </div>
            </div>

            {/* Coral note */}
            <div className="absolute bottom-12 right-0 w-48 rotate-6 rounded-[26px] bg-[#F88772] p-5 text-[#44251F] shadow-xl">
              <div className="mb-8 text-3xl">✎</div>

              <p className="font-bold leading-snug">
                Find the learning space that feels right.
              </p>
            </div>

            {/* Teal shortlist */}
            <div className="absolute bottom-0 left-14 -rotate-2 rounded-2xl bg-[#A5DCD1] px-5 py-4 shadow-lg">
              <p className="text-xs font-bold uppercase tracking-wider text-[#3D7168]">
                Your shortlist
              </p>

              <p className="mt-1 text-lg font-bold text-[#234D46]">
                6 places ♥
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="h-2 w-12 rounded-full bg-[#332D17]" />
          <div className="h-2 w-2 rounded-full bg-[#332D17]/30" />
          <div className="h-2 w-2 rounded-full bg-[#332D17]/30" />
        </div>
      </div>
    </div>
  );
}