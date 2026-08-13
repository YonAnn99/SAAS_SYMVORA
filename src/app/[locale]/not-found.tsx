"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  const t = useTranslations();

  const handleBack = () => {
    if (typeof window !== "undefined") {
      window.history.back();
    }
  };

  return (
    <div className="min-h-screen bg-white overflow-x-hidden flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 pt-32 pb-20">
        <motion.div
          className="max-w-xl w-full text-center flex flex-col items-center gap-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <motion.span
            className="text-[clamp(7rem,18vw,11rem)] leading-none font-bold tracking-tight text-black"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.05 }}
            aria-hidden="true"
          >
            {t("notFound.code")}
          </motion.span>

          <motion.h1
            className="text-3xl sm:text-4xl font-bold tracking-tight text-black"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.15 }}
          >
            {t("notFound.title")}
          </motion.h1>

          <motion.p
            className="text-base sm:text-lg text-neutral-500 max-w-md leading-relaxed"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
          >
            {t("notFound.description")}
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-3 mt-4 w-full sm:w-auto"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.25 }}
          >
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 bg-black text-white font-semibold px-6 py-3 rounded-lg hover:bg-neutral-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2"
            >
              <Home className="w-4 h-4" aria-hidden="true" />
              {t("notFound.home")}
            </Link>
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center justify-center gap-2 bg-white text-black font-semibold px-6 py-3 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              {t("notFound.back")}
            </button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
