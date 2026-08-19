import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer id="footer-contacto" className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-6 py-12 md:py-16 mt-20">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
        
        <div className="col-span-1 md:col-span-2 flex flex-col items-start gap-4">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/symvora-logo.webp" alt="SYMVORA" width={28} height={28} className="dark:invert" />
            <span className="font-bold text-xl tracking-tight">SYMVORA</span>
          </Link>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 max-w-xs">
            Tu sistema todo-en-uno para administrar, facturar y crecer tu negocio sin complicaciones.
          </p>
          
          <div className="mt-4 flex flex-col gap-2">
            <a href="mailto:hola@symvora.com.mx" className="text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
              hola@symvora.com.mx
            </a>
            <a href="tel:+525500000000" className="text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
              +52 (55) 0000-0000
            </a>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Síguenos</h3>
          <div className="flex gap-4">
            <a href="https://facebook.com/symvora" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-[#1877F2] transition-colors" aria-label="Facebook">
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
              </svg>
            </a>
            <a href="https://instagram.com/symvora.mx" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-[#E4405F] transition-colors" aria-label="Instagram">
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" />
              </svg>
            </a>
            <a href="https://tiktok.com/@symvora" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-black dark:hover:text-white transition-colors" aria-label="TikTok">
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 2.12-.51 4.24-1.67 6.02-1.51 2.33-3.85 4.04-6.52 4.7-2.88.71-6.02.43-8.52-1.07-2.61-1.54-4.51-4.06-5.26-6.99-.7-2.73-.39-5.74 1.1-8.15 1.57-2.54 4.09-4.38 7.02-5.12 1.22-.3 2.5-.38 3.75-.24v4.26c-.84-.14-1.73-.08-2.52.26-1.55.65-2.81 1.95-3.35 3.52-.5 1.48-.41 3.16.24 4.56.63 1.34 1.83 2.4 3.23 2.87 1.56.51 3.32.32 4.77-.45 1.26-.68 2.22-1.9 2.56-3.3.16-.67.21-1.37.2-2.07V.02z" />
              </svg>
            </a>
          </div>
        </div>
        
        <div className="flex flex-col gap-4">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Legal</h3>
          <div className="flex flex-col gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <Link href="/privacidad" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Aviso de Privacidad</Link>
            <Link href="/terminos" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Términos y Condiciones</Link>
          </div>
        </div>

      </div>
    </footer>
  );
}