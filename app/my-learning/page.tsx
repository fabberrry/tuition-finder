import { SiteHeader, SiteFooter } from "@/components/site-shell";
import { MyLearning } from "@/components/my-learning";
export const metadata = { title: "My learning" };
export default function LearningPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="container">
        <MyLearning />
      </main>
      <SiteFooter />
    </>
  );
}
