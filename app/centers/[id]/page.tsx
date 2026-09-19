import { SiteHeader, SiteFooter } from "@/components/site-shell";
import { CenterProfile } from "@/components/center-profile";
export const metadata = { title: "Explore a tuition center" };
export default async function CenterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="container">
        <CenterProfile id={id} />
      </main>
      <SiteFooter />
    </>
  );
}
