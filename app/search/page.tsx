import { SiteHeader, SiteFooter } from "@/components/site-shell";
import { SearchForm } from "@/components/search-form";
import { SearchResults } from "@/components/search-results";
export const metadata = { title: "Find tuition" };
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = Object.fromEntries(
    Object.entries(raw).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="container">
        <div className="page-heading">
          <span className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span>
          <h1>
            Find your kind of <span className="highlight">tuition.</span>
          </h1>
          <p>
            Compare your options. Meet your teacher. Take the next step with
            confidence.
          </p>
        </div>
        <SearchForm defaults={params} />
        <SearchResults key={JSON.stringify(params)} params={params} />
      </main>
      <SiteFooter />
    </>
  );
}
