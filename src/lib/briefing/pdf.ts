const HTML2CANVAS_URL = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
const JSPDF_URL = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';

async function loadScriptOnce(src: string) {
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
  if (existing) {
    await new Promise<void>((resolve, reject) => {
      if (existing.dataset.ready) resolve();
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)));
    });
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.ready = 'false';
    script.onload = () => {
      script.dataset.ready = 'true';
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

async function ensurePdfDeps() {
  const pdfWindow = window as typeof window & {
    html2canvas?: (element: HTMLElement, options?: Record<string, unknown>) => Promise<HTMLCanvasElement>;
    jspdf?: { jsPDF: typeof import('jspdf').jsPDF };
  };

  if (typeof pdfWindow.html2canvas === 'function' && pdfWindow.jspdf?.jsPDF) {
    return;
  }

  await Promise.all([
    loadScriptOnce(HTML2CANVAS_URL),
    loadScriptOnce(JSPDF_URL),
  ]);

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
