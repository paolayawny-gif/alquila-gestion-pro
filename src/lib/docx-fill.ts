'use client';
/**
 * Fill a .docx template by replacing [VARIABLE] markers directly in the XML.
 * Uses PizZip (already a dependency of docxtemplater).
 * No extra server needed — runs entirely in the browser.
 */

import PizZip from 'pizzip';

export interface DocxVariables {
  [key: string]: string;
}

/**
 * Fetch a template from /templates/, fill variables, and trigger a browser download.
 * @param templateFilename  The filename inside /public/templates/  (e.g. "Modelo Contrato Locación de Vivienda (1).docx")
 * @param variables         Map of placeholder text → replacement value
 * @param outputFilename    Suggested filename for the download
 */
export async function fillAndDownloadDocx(
  templateFilename: string,
  variables: DocxVariables,
  outputFilename: string
): Promise<void> {
  // 1. Fetch the template
  const res = await fetch(`/templates/${encodeURIComponent(templateFilename)}`);
  if (!res.ok) throw new Error(`No se pudo cargar la plantilla "${templateFilename}"`);
  const arrayBuffer = await res.arrayBuffer();

  // 2. Open as zip
  const zip = new PizZip(arrayBuffer);

  // 3. Replace in document.xml (main body)
  const filesToPatch = ['word/document.xml', 'word/header1.xml', 'word/footer1.xml'];
  for (const xmlPath of filesToPatch) {
    const file = zip.file(xmlPath);
    if (!file) continue;
    let content = file.asText();

    // Replace each variable — search for the literal text inside the XML
    for (const [placeholder, value] of Object.entries(variables)) {
      // The placeholder may be split across XML tags (Word likes to split text nodes).
      // Do a simple literal replacement first; if the placeholder is short it usually works.
      content = replaceAll(content, placeholder, value || '___________');
    }

    zip.file(xmlPath, content);
  }

  // 4. Generate the modified .docx and trigger download
  const output = zip.generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  const url = URL.createObjectURL(output);
  const a = document.createElement('a');
  a.href = url;
  a.download = outputFilename;
  a.click();
  URL.revokeObjectURL(url);
}

function replaceAll(str: string, find: string, replace: string): string {
  // Escape special regex characters in `find`
  const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return str.replace(new RegExp(escaped, 'g'), replace);
}

/** Number → Argentine written form (up to 9,999,999) */
export function numberToWords(n: number): string {
  if (!n || isNaN(n)) return '';
  const units = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
    'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
  const tens = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const hundreds = ['', 'CIEN', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
    'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  function below1000(num: number): string {
    if (num === 0) return '';
    if (num < 20) return units[num];
    if (num < 100) {
      const t = Math.floor(num / 10);
      const u = num % 10;
      return tens[t] + (u ? ' Y ' + units[u] : '');
    }
    if (num === 100) return 'CIEN';
    const h = Math.floor(num / 100);
    const rest = num % 100;
    return hundreds[h] + (rest ? ' ' + below1000(rest) : '');
  }

  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;

  let result = '';
  if (millions) result += (millions === 1 ? 'UN MILLÓN' : below1000(millions) + ' MILLONES') + ' ';
  if (thousands) result += (thousands === 1 ? 'MIL' : below1000(thousands) + ' MIL') + ' ';
  if (rest) result += below1000(rest);
  return result.trim() || 'CERO';
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export function formatDateParts(isoDate: string): { dia: string; mes: string; anio: string } {
  const d = new Date(isoDate + 'T12:00:00');
  return {
    dia: String(d.getDate()),
    mes: MESES[d.getMonth()],
    anio: String(d.getFullYear()),
  };
}

/** Duration in months → written text: "VEINTICUATRO (24) MESES" */
export function monthsToLabel(months: number): string {
  const words: Record<number,string> = {
    12:'DOCE', 18:'DIECIOCHO', 24:'VEINTICUATRO', 36:'TREINTA Y SEIS', 48:'CUARENTA Y OCHO', 60:'SESENTA'
  };
  const w = words[months] ?? numberToWords(months);
  return `${w} (${months}) MESES`;
}
