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

declare module 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm' {
  import type html2canvas from 'html2canvas';
  export default html2canvas;
}

declare module 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm' {
  export { jsPDF } from 'jspdf';
}
