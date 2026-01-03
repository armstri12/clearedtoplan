type Html2CanvasFn = (element: HTMLElement, options?: Record<string, unknown>) => Promise<HTMLCanvasElement>;

export async function downloadElementAsPdf(element: HTMLElement, filename = 'flight-brief.pdf') {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    // Remote, on-demand imports to avoid bundling heavy PDF tooling in the main bundle
    import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm') as Promise<{ default: Html2CanvasFn }>,
    import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm') as Promise<{ jsPDF: typeof import('jspdf').jsPDF }>,
  ]);

  const canvas = await html2canvas(element, { scale: 2, useCORS: true });
  const imgData = canvas.toDataURL('image/png');

  const pdf = new jsPDF('p', 'pt', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
  const renderWidth = canvas.width * ratio;
  const renderHeight = canvas.height * ratio;

  pdf.addImage(imgData, 'PNG', 0, 0, renderWidth, renderHeight, undefined, 'FAST');
  pdf.save(filename);
}
