
interface ExportColumn<T> {
  header: string;
  accessor: (row: T) => string | number;
}

/**
 * jsPDF y su plugin de tablas pesan ~350 kB: se descargan al generar el primer
 * PDF, no al abrir la pantalla.
 */
async function cargarJsPdf() {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  return { jsPDF, autoTable };
}

export async function exportToPDF<T>(
  data: T[],
  columns: ExportColumn<T>[],
  title: string,
  filename: string
): Promise<void> {
  const { jsPDF, autoTable } = await cargarJsPdf();
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text("SYMVORA", 14, 22);

  doc.setFontSize(12);
  doc.text(title, 14, 30);

  doc.setFontSize(9);
  doc.setTextColor(128);
  doc.text(`Fecha: ${new Date().toLocaleDateString("es-MX")}`, 14, 36);

  const tableHeaders = columns.map((col) => col.header);
  const tableData = data.map((row) =>
    columns.map((col) => String(col.accessor(row)))
  );

  autoTable(doc, {
    startY: 42,
    head: [tableHeaders],
    body: tableData,
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [17, 17, 17],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [247, 246, 243],
    },
    margin: { top: 42 },
  });

  doc.save(`${filename}_${new Date().toISOString().split("T")[0]}.pdf`);
}
