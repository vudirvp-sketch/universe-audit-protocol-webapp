/**
 * File Reader Module — reads .txt, .md, .docx, .pdf files in the browser.
 *
 * Supported formats:
 * - .txt / .md: FileReader.readAsText() — built-in browser API
 * - .docx: mammoth library (lightweight, ~50KB, works in browser)
 * - .pdf: pdfjs-dist library (Mozilla PDF.js, extracts text by page)
 *
 * No hard file size limit — the chunking module handles oversized content.
 * Warnings are shown at 5MB and 10MB thresholds.
 *
 * Usage:
 *   import { readFileAsText } from '@/lib/file-reader';
 *   const text = await readFileAsText(file);
 */

// ============================================================================
// TYPES
// ============================================================================

export interface FileInfo {
  name: string;
  size: number;
  type: string;
  extension: string;
  charCount: number;
}

export interface ReadResult {
  text: string;
  info: FileInfo;
  warnings: string[];
}

// ============================================================================
// SUPPORTED FORMATS
// ============================================================================

const SUPPORTED_EXTENSIONS = ['.txt', '.md', '.docx', '.pdf'];

// Warning thresholds
const WARNING_5MB = 5 * 1024 * 1024;
const WARNING_10MB = 10 * 1024 * 1024;

/**
 * Get the file extension from a filename.
 */
function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot >= 0 ? filename.slice(lastDot).toLowerCase() : '';
}

/**
 * Check if a file is supported by this module.
 */
export function isFileSupported(file: File): boolean {
  const ext = getExtension(file.name);
  return SUPPORTED_EXTENSIONS.includes(ext);
}

/**
 * Get a human-readable description of supported formats.
 */
export function getSupportedFormatsDescription(): string {
  return 'Поддерживаемые форматы: .txt, .md, .docx, .pdf';
}

// ============================================================================
// FILE READERS
// ============================================================================

/**
 * Read a .txt or .md file as text using the FileReader API.
 */
function readPlainText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.onerror = () => {
      reject(new Error(`Ошибка чтения файла ${file.name}`));
    };
    reader.readAsText(file);
  });
}

/**
 * Read a .docx file using the mammoth library.
 * mammoth.extractRawText() extracts all text content from the document,
 * preserving paragraph breaks but stripping formatting.
 *
 * The mammoth library is loaded dynamically to avoid bundling it
 * when the user never uploads a .docx file.
 */
async function readDocx(file: File): Promise<string> {
  try {
    const mammoth = await import('mammoth').catch(() => null);
    if (!mammoth) {
      throw new Error(
        'Формат DOCX не поддерживается в данной версии приложения. Используйте формат TXT, MD или PDF.'
      );
    }
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } catch (error) {
    throw new Error(
      `Ошибка чтения DOCX: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Read a .pdf file using the pdfjs-dist library.
 * Extracts text from each page and concatenates them.
 *
 * The pdfjs-dist library is loaded dynamically to avoid bundling it
 * when the user never uploads a .pdf file.
 */
async function readPdf(file: File): Promise<string> {
  try {
    const pdfjsLib = await import('pdfjs-dist').catch(() => null);
    if (!pdfjsLib) {
      throw new Error(
        'Формат PDF не поддерживается в данной версии приложения. Используйте формат TXT или MD.'
      );
    }
    const arrayBuffer = await file.arrayBuffer();

    // Try to set up the worker
    try {
      const pdfjsWorker: { default?: string } | null = await import('pdfjs-dist/build/pdf.worker.mjs').catch(() => null);
      if (pdfjsWorker?.default) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker.default;
      }
    } catch {
      // Worker not available — PDF.js will fall back to main thread
    }

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const textParts: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: Record<string, unknown>) => (typeof item.str === 'string' ? item.str : '') as string)
        .join(' ');
      textParts.push(pageText);
    }

    return textParts.join('\n\n');
  } catch (error) {
    throw new Error(
      `Ошибка чтения PDF: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

/**
 * Read a file and extract its text content.
 *
 * Supports .txt, .md, .docx, .pdf formats.
 * Returns the extracted text along with file info and any warnings.
 *
 * @param file - The File object from the file input
 * @returns The extracted text and metadata
 * @throws Error if the file format is not supported
 */
export async function readFileAsText(file: File): Promise<ReadResult> {
  const extension = getExtension(file.name);
  const warnings: string[] = [];

  // Check format support
  if (!SUPPORTED_EXTENSIONS.includes(extension)) {
    throw new Error(
      `Неподдерживаемый формат файла: ${extension}. ${getSupportedFormatsDescription()}`
    );
  }

  // Size warnings (no hard limit — chunking handles large files)
  if (file.size > WARNING_10MB) {
    warnings.push(
      `Файл очень большого размера (${(file.size / 1024 / 1024).toFixed(1)}MB). ` +
      'Обработка может занять значительное время из-за разбиения на части (chunking).'
    );
  } else if (file.size > WARNING_5MB) {
    warnings.push(
      `Файл большого размера (${(file.size / 1024 / 1024).toFixed(1)}MB). ` +
      'Текст может обрабатываться долго из-за chunking\'а.'
    );
  }

  // Read based on format
  let text: string;
  switch (extension) {
    case '.txt':
    case '.md':
      text = await readPlainText(file);
      break;
    case '.docx':
      text = await readDocx(file);
      break;
    case '.pdf':
      text = await readPdf(file);
      break;
    default:
      throw new Error(`Неподдерживаемый формат: ${extension}`);
  }

  const info: FileInfo = {
    name: file.name,
    size: file.size,
    type: file.type || 'unknown',
    extension,
    charCount: text.length,
  };

  return { text, info, warnings };
}
