const HTML2CANVAS_URL = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm';
const JSPDF_URL = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm';

type Html2CanvasFn = (element: HTMLElement, options?: Record<string, unknown>) => Promise<HTMLCanvasElement>;

type PdfWindow = typeof window & {
  html2canvas?: Html2CanvasFn;
  jspdf?: { jsPDF: typeof import('jspdf').jsPDF };
};

async function ensurePdfDeps(pdfWindow: PdfWindow) {
  if (pdfWindow.html2canvas && pdfWindow.jspdf?.jsPDF) return;

  const [{ default: html2canvas }, jspdfModule] = await Promise.all([
    // Remote, on-demand imports to avoid bundling heavy PDF tooling in the main bundle
    import(/* @vite-ignore */ HTML2CANVAS_URL) as Promise<{ default: Html2CanvasFn }>,
    import(/* @vite-ignore */ JSPDF_URL) as Promise<typeof import('jspdf')>,
  ]);

  pdfWindow.html2canvas = html2canvas;
  pdfWindow.jspdf = { jsPDF: jspdfModule.jsPDF };
}

export async function downloadElementAsPdf(element: HTMLElement, filename = 'flight-brief.pdf') {
  const pdfWindow = window as PdfWindow;
  await ensurePdfDeps(pdfWindow);

  if (!pdfWindow.html2canvas || !pdfWindow.jspdf?.jsPDF) {
    throw new Error('PDF deps failed to load');
  }

  const canvas = await pdfWindow.html2canvas(element, { scale: 2, useCORS: true });
  const imgData = canvas.toDataURL('image/png');

  const pdf = new pdfWindow.jspdf.jsPDF('p', 'pt', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
  const renderWidth = canvas.width * ratio;
  const renderHeight = canvas.height * ratio;

  pdf.addImage(imgData, 'PNG', 0, 0, renderWidth, renderHeight, undefined, 'FAST');
  pdf.save(filename);
}
