const HTML2CANVAS_URL = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
const JSPDF_URL = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';

export async function downloadElementAsPdf(element: HTMLElement, filename = 'flight-brief.pdf') {
  const [{ default: html2canvas }, jspdfModule] = await Promise.all([
    // Remote, on-demand imports to avoid bundling heavy PDF tooling in the main bundle
    import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm') as Promise<{ default: Html2CanvasFn }>,
    import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm') as Promise<typeof import('jspdf')>,
  ]);
  const { jsPDF } = jspdfModule;

  if (!pdfWindow.html2canvas || !pdfWindow.jspdf?.jsPDF) {
    throw new Error('PDF deps failed to load');
  }
}

export async function downloadElementAsPdf(element: HTMLElement, filename = 'flight-brief.pdf') {
  const pdfWindow = window as typeof window & {
    html2canvas?: (element: HTMLElement, options?: Record<string, unknown>) => Promise<HTMLCanvasElement>;
    jspdf?: { jsPDF: typeof import('jspdf').jsPDF };
  };

  await ensurePdfDeps();

  const canvas = await pdfWindow.html2canvas!(element, { scale: 2, useCORS: true });
  const imgData = canvas.toDataURL('image/png');

  const pdf = new pdfWindow.jspdf!.jsPDF('p', 'pt', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
  const renderWidth = canvas.width * ratio;
  const renderHeight = canvas.height * ratio;

  pdf.addImage(imgData, 'PNG', 0, 0, renderWidth, renderHeight, undefined, 'FAST');
  pdf.save(filename);
}
