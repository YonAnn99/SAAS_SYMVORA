"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "motion/react";
import {
  Store,
  Leaf,
  PawPrint,
  Shirt,
  Wrench,
  Pill,
  Building2,
  Search,
  Plus,
  Scale,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import {
  easeOutLong,
  easeOutShort,
  staggerContainer,
  fadeInUp,
  springIcon,
} from "./animations";

const keys = [
  "ABARROTES",
  "VERDULERIA",
  "MASCOTAS",
  "ROPA",
  "FERRETERIA",
  "FARMACIA",
  "GENERAL",
] as const;

type GiroKey = (typeof keys)[number];

const icons: Record<GiroKey, typeof Store> = {
  ABARROTES: Store,
  VERDULERIA: Leaf,
  MASCOTAS: PawPrint,
  ROPA: Shirt,
  FERRETERIA: Wrench,
  FARMACIA: Pill,
  GENERAL: Building2,
};

function MockupAbarrotes() {
  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      {[
        { name: "Leche Lala 1L", price: "$28" },
        { name: "Tortillas 1kg", price: "$22" },
        { name: "Arroz 1kg", price: "$35" },
        { name: "Frijol 1kg", price: "$48" },
      ].map((p) => (
        <div
          key={p.name}
          className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-3 bg-white dark:bg-neutral-900 hover:border-blue-400 transition-colors"
        >
          <div className="font-medium text-neutral-900 dark:text-neutral-100 truncate">{p.name}</div>
          <div className="flex items-center justify-between mt-2">
            <span className="font-bold text-neutral-900 dark:text-neutral-100">{p.price}</span>
            <button
              type="button"
              className="bg-blue-600 text-white rounded p-1 hover:bg-blue-700"
              aria-label="Agregar"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function MockupVerduleria() {
  return (
    <div className="space-y-3 text-xs">
      <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-3 bg-white dark:bg-neutral-900">
        <div className="flex items-center justify-between">
          <span className="font-medium text-neutral-900 dark:text-neutral-100">Manzana por kilo</span>
          <span className="font-bold text-neutral-900 dark:text-neutral-100">$48/kg</span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Scale className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
          <input
            type="text"
            value="2.350 kg"
            readOnly
            className="flex-1 border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1 text-neutral-900 dark:text-neutral-100 font-bold dark:bg-neutral-800"
          />
        </div>
        <div className="mt-2 text-right text-blue-600 font-bold">Subtotal: $112.80</div>
      </div>
      <div className="border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg p-3 text-emerald-800 dark:text-emerald-300">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span className="font-medium">Cálculo automático por peso</span>
        </div>
      </div>
    </div>
  );
}

function MockupRopa() {
  const sizes = ["CH", "M", "G", "XG"];
  const colors = ["Negro", "Blanco", "Azul"];
  return (
    <div className="space-y-3 text-xs">
      <div className="font-medium text-neutral-900 dark:text-neutral-100">Camiseta básica — Stock por variante</div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-neutral-100 dark:bg-neutral-800">
              <th className="border border-neutral-200 dark:border-neutral-700 p-2 text-left"></th>
              {sizes.map((s) => (
                <th key={s} className="border border-neutral-200 dark:border-neutral-700 p-2 text-center font-medium text-neutral-700 dark:text-neutral-300">
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {colors.map((c, i) => (
              <tr key={c} className={i % 2 === 0 ? "bg-white dark:bg-neutral-900" : "bg-neutral-50 dark:bg-neutral-800"}>
                <td className="border border-neutral-200 dark:border-neutral-700 p-2 font-medium text-neutral-700 dark:text-neutral-300">{c}</td>
                {sizes.map((s, j) => {
                  const stock = [3, 8, 12, 5][j];
                  return (
                    <td
                      key={s}
                      className={`border border-neutral-200 dark:border-neutral-700 p-2 text-center font-bold ${
                        stock < 5 ? "text-amber-600" : "text-neutral-900 dark:text-neutral-100"
                      }`}
                    >
                      {stock}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MockupFarmacia() {
  return (
    <div className="space-y-2 text-xs">
      <div className="font-medium text-neutral-900 dark:text-neutral-100 mb-2">Lotes próximos a caducar</div>
      {[
        { name: "Paracetamol 500mg", lot: "L-2341", days: 12, critical: true },
        { name: "Ibuprofeno 400mg", lot: "L-1890", days: 45, critical: false },
        { name: "Amoxicilina 250mg", lot: "L-3102", days: 7, critical: true },
      ].map((m) => (
        <div
          key={m.lot}
          className={`border rounded-lg p-3 flex items-center justify-between ${
            m.critical ? "border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10" : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
          }`}
        >
          <div>
            <div className="font-medium text-neutral-900 dark:text-neutral-100">{m.name}</div>
            <div className="text-neutral-500 dark:text-neutral-400">Lote {m.lot}</div>
          </div>
          <div
            className={`flex items-center gap-1 font-bold ${
              m.critical ? "text-amber-700 dark:text-amber-400" : "text-neutral-700 dark:text-neutral-300"
            }`}
          >
            {m.critical && <AlertTriangle className="w-3.5 h-3.5" />}
            {m.days}d
          </div>
        </div>
      ))}
    </div>
  );
}

function MockupFerreteria() {
  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-center gap-2 border border-neutral-200 dark:border-neutral-800 rounded-lg p-2 bg-white dark:bg-neutral-900">
        <Search className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
        <span className="text-neutral-500 dark:text-neutral-400">SKU: TAL-12X40-AZ</span>
      </div>
      <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-3 bg-white dark:bg-neutral-900">
        <div className="flex items-center justify-between">
          <span className="font-medium text-neutral-900 dark:text-neutral-100">TALADROMAKITA 12V</span>
          <span className="font-bold text-neutral-900 dark:text-neutral-100">$2,450</span>
        </div>
        <div className="text-neutral-500 dark:text-neutral-400 mt-1">Stock: 7 unidades · Refacción disponible</div>
      </div>
    </div>
  );
}

function MockupMascotas() {
  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      {[
        { name: "Croquetas Adulto 15kg", price: "$680" },
        { name: "Snack dental", price: "$95" },
        { name: "Arena para gato", price: "$220" },
        { name: "Juguete mordedera", price: "$120" },
      ].map((p) => (
        <div
          key={p.name}
          className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-3 bg-white dark:bg-neutral-900 hover:border-blue-400 transition-colors"
        >
          <div className="font-medium text-neutral-900 dark:text-neutral-100 truncate">{p.name}</div>
          <div className="flex items-center justify-between mt-2">
            <span className="font-bold text-neutral-900 dark:text-neutral-100">{p.price}</span>
            <button
              type="button"
              className="bg-blue-600 text-white rounded p-1 hover:bg-blue-700"
              aria-label="Agregar"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function MockupGeneral() {
  return (
    <div className="text-xs space-y-2">
      <div className="font-medium text-neutral-900 dark:text-neutral-100">Configuración flexible</div>
      <div className="grid grid-cols-3 gap-2">
        {["POS", "Inventario", "CFDI", "Caja", "Reportes", "Usuarios"].map((m) => (
          <div
            key={m}
            className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-2 bg-white dark:bg-neutral-900 text-center font-medium text-neutral-700 dark:text-neutral-300"
          >
            {m}
          </div>
        ))}
      </div>
      <div className="text-neutral-500 dark:text-neutral-400 mt-2">Activa solo los módulos que tu negocio necesita.</div>
    </div>
  );
}

const mockups: Record<GiroKey, () => React.JSX.Element> = {
  ABARROTES: MockupAbarrotes,
  VERDULERIA: MockupVerduleria,
  ROPA: MockupRopa,
  FARMACIA: MockupFarmacia,
  FERRETERIA: MockupFerreteria,
  MASCOTAS: MockupMascotas,
  GENERAL: MockupGeneral,
};

export function BusinessTypes() {
  const t = useTranslations();
  const [active, setActive] = useState<GiroKey>("ABARROTES");
  const ActiveMockup = mockups[active];
  const ActiveIcon = icons[active];

  return (
    <motion.section
      id="industries"
      className="w-full py-24 bg-neutral-50 dark:bg-neutral-900 border-t border-neutral-100 dark:border-neutral-800"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={easeOutLong}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-12">
        <motion.div
          className="flex flex-col items-center text-center gap-4 max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={easeOutShort}
        >
          <motion.div
            className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-500/10 px-3 py-1 rounded-full border border-blue-100 dark:border-blue-500/20"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={easeOutShort}
          >
            <span className="text-xs font-medium text-blue-600 uppercase tracking-widest">
              {t("landing.businessTypes.badge")}
            </span>
          </motion.div>
          <motion.h2
            className="text-3xl sm:text-4xl font-bold text-black dark:text-neutral-50"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ ...easeOutShort, delay: 0.1 }}
          >
            {t("landing.businessTypes.title")}
          </motion.h2>
          <motion.p
            className="text-lg text-neutral-500 dark:text-neutral-400"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ ...easeOutShort, delay: 0.2 }}
          >
            {t("landing.businessTypes.subtitle")}
          </motion.p>
        </motion.div>

        <div
          role="tablist"
          aria-label="Giros comerciales"
          className="flex flex-wrap justify-center gap-2"
        >
          {keys.map((key) => {
            const Icon = icons[key];
            const isActive = active === key;
            return (
              <motion.button
                key={key}
                role="tab"
                type="button"
                aria-selected={isActive}
                onClick={() => setActive(key)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-all flex items-center gap-2 ${
                  isActive
                    ? "bg-black text-white border-black shadow-sm"
                    : "bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700 dark:hover:border-neutral-500"
                }`}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.96 }}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={easeOutShort}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                {t(`landing.businessTypes.types.${key}.name`)}
              </motion.button>
            );
          })}
        </div>

        <motion.div
          key={active}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={easeOutShort}
          className="grid lg:grid-cols-2 gap-6 max-w-5xl mx-auto w-full"
        >
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <ActiveMockup />
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex flex-col justify-center gap-4">
            <motion.div
              key={`icon-${active}`}
              className="w-12 h-12 bg-blue-50 dark:bg-blue-500/10 text-blue-600 rounded-xl flex items-center justify-center"
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={springIcon}
            >
              <ActiveIcon className="w-6 h-6" aria-hidden="true" />
            </motion.div>
            <motion.h3
              key={`title-${active}`}
              className="text-2xl font-bold text-black dark:text-neutral-50"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...easeOutShort, delay: 0.1 }}
            >
              {t(`landing.businessTypes.types.${active}.name`)}
            </motion.h3>
            <motion.p
              key={`desc-${active}`}
              className="text-base text-neutral-500 dark:text-neutral-400 leading-relaxed"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...easeOutShort, delay: 0.15 }}
            >
              {t(`landing.businessTypes.types.${active}.desc`)}
            </motion.p>
          </div>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl mx-auto w-full"
        >
          {[
            { icon: CheckCircle2, label: "Activación por giro" },
            { icon: CheckCircle2, label: "Módulos opcionales" },
            { icon: CheckCircle2, label: "Sin configuración técnica" },
          ].map((item) => (
            <motion.div
              key={item.label}
              variants={fadeInUp}
              transition={easeOutLong}
              className="flex items-center gap-2 justify-center text-sm text-neutral-600 dark:text-neutral-300 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-4 py-3"
            >
              <item.icon className="w-4 h-4 text-emerald-500" aria-hidden="true" />
              {item.label}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.section>
  );
}
