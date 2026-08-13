import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";

interface LegalShellProps {
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}

export function LegalShell({ title, updatedAt, children }: LegalShellProps) {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-20">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-black">
          {title}
        </h1>
        <p className="mt-2 text-sm text-neutral-400">Última actualización: {updatedAt}</p>
        <div className="mt-10 text-neutral-600 leading-relaxed space-y-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-black [&_h2]:mt-10 [&_h2]:first:mt-0 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-2 [&_a]:underline [&_a]:underline-offset-2 [&_a]:text-neutral-900 [&_a]:hover:text-black">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}