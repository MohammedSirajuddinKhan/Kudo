import * as XLSX from "xlsx";

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png"];
export const MAX_FILE_SIZE_MB = 15;
export const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;

/**
 * Upload a blob to Convex storage using a caller-provided URL generator
 * (generateUploadUrl mutation) and return the storage id.
 */
export async function uploadToStorage(
  blob: Blob,
  generateUrl: () => Promise<string>,
): Promise<string> {
  const url = await generateUrl();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": blob.type || "application/octet-stream" },
    body: blob,
  });
  if (!res.ok) {
    throw new Error("Upload failed. Check your connection and try again.");
  }
  const { storageId } = (await res.json()) as { storageId: string };
  return storageId;
}

export interface ParsedAsset {
  renderBlob: Blob;
  renderWidth: number;
  renderHeight: number;
}

/** Load pdf.js worker from the installed package (bundled by Vite). */
async function getPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  // Vite-friendly worker setup.
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjs;
}

/**
 * Normalize any supported upload into a PNG render asset. Images pass through
 * with a canvas pass that also guarantees CORS-clean pixels. PDFs have their
 * first page rasterized at high resolution. The original file is stored
 * separately and never modified.
 */
export async function normalizeUpload(file: File): Promise<ParsedAsset> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File is too large. Maximum size is ${MAX_FILE_SIZE_MB} MB.`);
  }
  const isImage = ACCEPTED_IMAGE_TYPES.includes(file.type);
  const isPdf = file.type === "application/pdf";
  if (!isImage && !isPdf) {
    throw new Error("Unsupported format. Upload a JPG, JPEG, PNG, or PDF file.");
  }

  const url = URL.createObjectURL(file);
  try {
    if (isImage) {
      const img = new Image();
      img.src = url;
      await img.decode();
      const canvas = document.createElement("canvas");
      // Cap the render resolution to keep storage and analysis payloads sane
      // while staying well above print quality for typical certificates.
      const maxSide = 2200;
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas is not supported in this browser.");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/png"),
      );
      if (!blob) throw new Error("Could not process the image. Try a different file.");
      return { renderBlob: blob, renderWidth: canvas.width, renderHeight: canvas.height };
    }

    // PDF: rasterize page 1 at high resolution.
    const pdfjs = await getPdfjs();
    const data = new Uint8Array(await file.arrayBuffer());
    const doc = await pdfjs.getDocument({ data }).promise;
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 2.2 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.min(2400, Math.round(viewport.width));
    canvas.height = Math.min(1700, Math.round(viewport.height));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not supported in this browser.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: canvas.width < viewport.width ? page.getViewport({ scale: (2.2 * canvas.width) / viewport.width }) : viewport }).promise;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png"),
    );
    if (!blob) throw new Error("Could not process the PDF. Try a different file.");
    return { renderBlob: blob, renderWidth: canvas.width, renderHeight: canvas.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface ParsedSheet {
  columns: string[];
  rows: Array<Record<string, string>>;
}

/** Parse an XLSX or CSV file into columns + rows (all values as strings). */
export function parseSpreadsheet(file: File): Promise<ParsedSheet> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.onload = () => {
      try {
        const data = new Uint8Array(reader.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        if (!sheet) throw new Error("The spreadsheet has no readable sheets.");
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: "",
          raw: false,
        });
        const columns = new Set<string>();
        for (const row of json) Object.keys(row).forEach((k) => columns.add(k));
        const rows = json.map((row) => {
          const out: Record<string, string> = {};
          for (const key of columns) {
            const v = row[key];
            out[key] = v === undefined || v === null ? "" : String(v).trim();
          }
          return out;
        });
        resolve({ columns: Array.from(columns), rows });
      } catch (e) {
        reject(new Error("The file could not be parsed as a spreadsheet. Check the format."));
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

/** Parse pasted tabular text (tab or comma separated). */
export function parsePastedText(text: string): ParsedSheet {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) throw new Error("Paste some rows first.");
  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const splitLine = (line: string) => {
    if (delimiter === "\t") return line.split("\t");
    // Simple CSV split that respects quotes.
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
    out.push(cur);
    return out;
  };
  const columns = splitLine(lines[0]).map((c) => c.trim() || `Column ${c}`);
  const rows = lines.slice(1).map((line) => {
    const cells = splitLine(line);
    const row: Record<string, string> = {};
    columns.forEach((col, i) => {
      row[col] = (cells[i] ?? "").trim();
    });
    return row;
  });
  return { columns, rows };
}

export function toCsv(columns: string[], rows: Array<Record<string, string>>): string {
  const esc = (v: string) => {
    const s = v ?? "";
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.map(esc).join(","), ...rows.map((r) => columns.map((c) => esc(r[c] ?? "")).join(","))].join("\n");
}

export function downloadCsv(fileName: string, columns: string[], rows: Array<Record<string, string>>) {
  const blob = new Blob([toCsv(columns, rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.endsWith(".csv") ? fileName : `${fileName}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Download a set of PNG blobs as a ZIP (via a tiny store-only zip writer). */
export async function downloadZip(files: Array<{ name: string; blob: Blob }>, zipName: string) {
  // Minimal store-only ZIP builder (no compression, fully valid archive).
  const encoder = new TextEncoder();
  const parts: Array<{ name: string; data: Uint8Array; crc: number; offset: number }> = [];
  const chunks: Uint8Array[] = [];
  let offset = 0;
  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  const crc32 = (data: Uint8Array) => {
    let c = 0xffffffff;
    for (let i = 0; i < data.length; i++) c = crcTable[(c ^ data[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const data = new Uint8Array(await file.blob.arrayBuffer());
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(8, 0, true); // store
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    chunks.push(local, data);
    parts.push({ name: file.name, data, crc, offset });
    offset += local.length + data.length;
  }

  const central: Uint8Array[] = [];
  let centralSize = 0;
  for (const p of parts) {
    const nameBytes = encoder.encode(p.name);
    const entry = new Uint8Array(46 + nameBytes.length);
    const v = new DataView(entry.buffer);
    v.setUint32(0, 0x02014b50, true);
    v.setUint16(4, 20, true);
    v.setUint16(6, 20, true);
    v.setUint16(8, 0, true);
    v.setUint32(16, p.crc, true);
    v.setUint32(20, p.data.length, true);
    v.setUint32(24, p.data.length, true);
    v.setUint16(28, nameBytes.length, true);
    v.setUint32(42, p.offset, true);
    entry.set(nameBytes, 46);
    central.push(entry);
    centralSize += entry.length;
  }

  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, parts.length, true);
  ev.setUint16(10, parts.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const total = new Uint8Array(offset + centralSize + 22);
  let pos = 0;
  for (const c of chunks) {
    total.set(c, pos);
    pos += c.length;
  }
  for (const c of central) {
    total.set(c, pos);
    pos += c.length;
  }
  total.set(end, pos);
  const blob = new Blob([total], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = zipName.endsWith(".zip") ? zipName : `${zipName}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
