/**
 * Registro de Chart.js con SOLO lo que usan las graficas del proyecto.
 *
 * Chart.js 4 es tree-shakeable: importar `chart.js/auto` metería todos los
 * tipos de grafica, escalas y plugins. Cada grafica importa este modulo una vez;
 * registrar dos veces lo mismo no hace nada.
 */
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  DoughnutController,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";

ChartJS.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip
);

export { ChartJS };
