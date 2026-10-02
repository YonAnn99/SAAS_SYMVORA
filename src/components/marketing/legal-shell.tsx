import { AppFrame } from "@/components/ui/app-frame";
import Footer from "@/components/ui/footer";

interface LegalShellProps {
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}

/**
 * Marco de las paginas legales (Terminos, Aviso de Privacidad, Cookies): el
 * mismo `AppFrame` y footer que la landing, como Nosotros y Aprende. Antes
 * usaba el encabezado viejo (con "Productos") y hacia scroll en el documento.
 * El texto legal es solo en español, de ahi `inicio="/es"`.
 */
export function LegalShell({ title, updatedAt, children }: LegalShellProps) {
  return (
    <AppFrame inicio="/es">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-20">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-black dark:text-neutral-50">
          {title}
        </h1>
        <p className="mt-2 text-sm text-neutral-400 dark:text-neutral-500">Última actualización: {updatedAt}</p>
        <div className="mt-10 text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-black dark:[&_h2]:text-neutral-50 [&_h2]:mt-10 [&_h2]:first:mt-0 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-2 [&_a]:underline [&_a]:underline-offset-2 [&_a]:text-neutral-900 dark:[&_a]:text-neutral-100 [&_a]:hover:text-black dark:[&_a]:hover:text-neutral-50">
          {children}
        </div>
      </div>
      <Footer />
    </AppFrame>
  );
}
