declare module "pdf-parse/lib/pdf-parse.js" {
  interface PdfResult {
    text: string;
    numpages: number;
  }
  function pdfParse(buffer: Buffer): Promise<PdfResult>;
  export default pdfParse;
}
