import { ReactNode } from "react";

type AuthLayoutProps = {
  form: ReactNode;
  artwork: ReactNode;
};

export default function AuthLayout({
  form,
  artwork,
}: AuthLayoutProps) {
  return (
    <main className="min-h-screen bg-[#FFFDF6] p-4 md:p-6">
      <div className="mx-auto flex min-h-[calc(100vh-32px)] max-w-7xl overflow-hidden rounded-[32px] border border-[#F1E7C7] bg-white shadow-[0_20px_70px_rgba(103,80,20,0.12)] md:min-h-[calc(100vh-48px)]">
        <section className="flex w-full items-center justify-center px-6 py-10 md:w-1/2 md:px-12 lg:px-20">
          {form}
        </section>

        <section className="hidden w-1/2 md:block">
          {artwork}
        </section>
      </div>
    </main>
  );
}