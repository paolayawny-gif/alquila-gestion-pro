import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
}

export function exportToPDF(
  title: string,
  subtitle: string,
  columns: ExportColumn[],
  rows: Record<string, string | number>[],
  filename: string,
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 16);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text(subtitle, 14, 23);
  doc.text(`Generado: ${new Date().toLocaleDateString('es-AR')}`, doc.internal.pageSize.width - 14, 23, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: 30,
    head: [columns.map(c => c.header)],
    body: rows.map(row => columns.map(c => row[c.key] ?? '')),
    headStyles: {
      fillColor: [29, 158, 117],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: { fontSize: 8.5 },
    alternateRowStyles: { fillColor: [245, 250, 248] },
    columnStyles: columns.reduce<Record<number, { cellWidth?: number }>>((acc, col, i) => {
      if (col.width) acc[i] = { cellWidth: col.width };
      return acc;
    }, {}),
    margin: { left: 14, right: 14 },
  });

  doc.save(`${filename}.pdf`);
}

export function exportToExcel(
  sheetName: string,
  columns: ExportColumn[],
  rows: Record<string, string | number>[],
  filename: string,
) {
  const ws = XLSX.utils.json_to_sheet(
    rows.map(row =>
      columns.reduce<Record<string, string | number>>((acc, col) => {
        acc[col.header] = row[col.key] ?? '';
        return acc;
      }, {}),
    ),
    { header: columns.map(c => c.header) },
  );

  // Column widths
  ws['!cols'] = columns.map(c => ({ wch: c.width ?? 20 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
