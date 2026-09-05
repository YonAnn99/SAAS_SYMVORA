"use client";

import { motion } from "motion/react";
import { Search, Plus, ShoppingCart, X, Barcode } from "lucide-react";
import { useTranslations } from "next-intl";
import { easeOutShort, springIcon } from "./animations";

const items = [
  { key: "milk", price: 28 },
  { key: "apple", price: 48, bulk: true },
  { key: "tortillas", price: 22 },
  { key: "rice", price: 35 },
] as const;

export function PosMockup() {
  const t = useTranslations();

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/60">
        <span className="w-3 h-3 rounded-full bg-red-400" aria-hidden="true" />
        <span className="w-3 h-3 rounded-full bg-amber-400" aria-hidden="true" />
        <span className="w-3 h-3 rounded-full bg-emerald-400" aria-hidden="true" />
        <span className="ml-3 text-xs text-neutral-500 dark:text-neutral-400 font-medium">SYMVORA · POS</span>
      </div>

      <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-2">
        <Search className="w-4 h-4 text-neutral-400 dark:text-neutral-500 shrink-0" aria-hidden="true" />
        <span className="text-xs text-neutral-400 dark:text-neutral-500 truncate">
          {t("landing.hero.mockup.searchPlaceholder")}
        </span>
        <Barcode className="w-4 h-4 text-neutral-400 dark:text-neutral-500 ml-auto shrink-0" aria-hidden="true" />
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 p-3 grid grid-cols-2 gap-1.5 content-start overflow-hidden">
          <span className="col-span-2 text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
            {t("landing.hero.mockup.products")}
          </span>
          {items.map((item, i) => (
            <motion.div
              key={item.key}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 + i * 0.08, ...easeOutShort }}
              className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-1.5 hover:border-blue-400 dark:hover:border-blue-900 transition-colors cursor-pointer"
            >
              <div className="text-[10px] font-medium text-neutral-900 dark:text-neutral-100 truncate leading-tight">
                {t(`landing.hero.mockup.items.${item.key}`)}
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] font-bold text-neutral-900 dark:text-neutral-100">${item.price}</span>
                <motion.span
                  className="w-4 h-4 bg-blue-600 text-white rounded flex items-center justify-center"
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  transition={springIcon}
                  aria-hidden="true"
                >
                  <Plus className="w-2.5 h-2.5" />
                </motion.span>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="w-[42%] border-l border-neutral-200 dark:border-neutral-800 p-3 flex flex-col bg-neutral-50 dark:bg-neutral-800/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-1">
              <ShoppingCart className="w-3 h-3" aria-hidden="true" />
              {t("landing.hero.mockup.cart")}
            </span>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500">3</span>
          </div>

          <div className="flex-1 space-y-1.5 overflow-hidden">
            {[
              { name: t("landing.hero.mockup.items.milk"), price: 28, qty: 2 },
              { name: t("landing.hero.mockup.items.apple"), price: 48, qty: 1 },
              { name: t("landing.hero.mockup.items.tortillas"), price: 22, qty: 1 },
            ].map((row, i) => (
              <motion.div
                key={row.name}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.2 + i * 0.1, ...easeOutShort }}
                className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded px-2 py-1.5 flex items-center gap-1"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-medium text-neutral-900 dark:text-neutral-100 truncate">
                    {row.name}
                  </div>
                  <div className="text-[9px] text-neutral-500 dark:text-neutral-400">
                    {row.qty} × ${row.price}
                  </div>
                </div>
                <X className="w-3 h-3 text-neutral-300 dark:text-neutral-600" aria-hidden="true" />
              </motion.div>
            ))}
          </div>

          <div className="mt-2 pt-2 border-t border-neutral-200 dark:border-neutral-800 space-y-1">
            <div className="flex justify-between text-[10px] text-neutral-500 dark:text-neutral-400">
              <span>{t("landing.hero.mockup.subtotal")}</span>
              <span>$126.00</span>
            </div>
            <div className="flex justify-between text-xs font-bold text-neutral-900 dark:text-neutral-50">
              <span>{t("landing.hero.mockup.total")}</span>
              <span>$146.16</span>
            </div>
          </div>

          <motion.button
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.7, ...easeOutShort }}
            className="mt-2 w-full bg-blue-600 text-white text-xs font-semibold py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            {t("landing.hero.mockup.charge")}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
