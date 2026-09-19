import Link from "next/link";

export default function AuthLogo() {
  return (
    <Link href="/" className="inline-flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFD84D] text-sm font-black text-[#2E2918] shadow-sm">
        TL
      </div>

      <span className="text-xl font-bold tracking-tight text-[#28241A]">
        TuitionLens
      </span>
    </Link>
  );
}