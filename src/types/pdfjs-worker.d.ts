/**
 * Type declaration for the pdfjs-dist worker module.
 * This module doesn't ship with TypeScript declarations,
 * so we declare it manually to satisfy noImplicitAny.
 */
declare module 'pdfjs-dist/build/pdf.worker.mjs' {
  const workerSrc: string;
  export default workerSrc;
}
