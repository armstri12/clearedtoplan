declare module 'jspdf' {
  export class jsPDF {
    constructor(orientation?: string, unit?: string, format?: string | number[]);
    internal: {
      pageSize: {
        getWidth: () => number;
        getHeight: () => number;
      };
    };
    addImage(
      imageData: string,
      format: string,
      x: number,
      y: number,
      width: number,
      height: number,
      alias?: string,
      compression?: string,
    ): void;
    save(filename?: string): void;
  }
}

declare module 'html2canvas' {
  export default function html2canvas(element: HTMLElement, options?: Record<string, unknown>): Promise<HTMLCanvasElement>;
}

declare global {
  interface Window {
    html2canvas?: (element: HTMLElement, options?: Record<string, unknown>) => Promise<HTMLCanvasElement>;
    jspdf?: {
      jsPDF: typeof import('jspdf').jsPDF;
    };
  }
}
