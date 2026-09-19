import Link from "next/link";

export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="TuitionLens home">
      <span className="brand-mark" aria-hidden="true">
        t<span>l</span>
        <i />
      </span>
      <span>
        tuition<span className="brand-light">lens</span>
        <span className="brand-dot">.</span>
      </span>
    </Link>
  );
}
