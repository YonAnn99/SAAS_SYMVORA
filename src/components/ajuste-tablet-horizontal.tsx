import { scriptViewportTablet } from "@/lib/viewport-tablet";

/**
 * Tablet en horizontal → vista de escritorio, en el panel y en el login. Va en el `<body>` para que el
 * script corra antes del primer pintado y no haya salto de celular a escritorio. Sin hooks: funciona en el
 * servidor. La landing y el catálogo público no lo montan a propósito.
 */
export function AjusteTabletHorizontal() {
  return <script dangerouslySetInnerHTML={{ __html: scriptViewportTablet() }} />;
}
