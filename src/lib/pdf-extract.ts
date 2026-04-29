'use client';
/**
 * Client-side PDF text extraction using PDF.js (pdfjs-dist).
 * No API key required — runs entirely in the browser.
 */

export async function extractTextFromPdfDataUri(dataUri: string): Promise<string> {
  // Dynamic import so PDF.js only loads when needed
  const pdfjsLib = await import('pdfjs-dist');

  // Point the worker to the bundled worker file
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url
  ).toString();

  // Strip the data URI header to get raw base64, then decode to Uint8Array
  const base64 = dataUri.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (pageText) pageTexts.push(`--- Página ${pageNum} ---\n${pageText}`);
  }

  return pageTexts.join('\n\n');
}

export function isPdfDataUri(dataUri: string): boolean {
  return dataUri.startsWith('data:application/pdf');
}
