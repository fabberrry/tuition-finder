import Image from "next/image";

export function LearningArtwork() {
  return (
    <Image
      className="learning-artwork"
      src="/learning-book.svg"
      alt="An open book with a yellow bookmark, outlined against a yellow circle"
      width={560}
      height={440}
      loading="eager"
      unoptimized
    />
  );
}
