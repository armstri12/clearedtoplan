declare module 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm' {
  import type html2canvas from 'html2canvas';
  export default html2canvas;
}

declare module 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm' {
  import type * as JsPDFModule from 'jspdf';
  export default JsPDFModule;
  export * from 'jspdf';
}
