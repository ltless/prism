import { MediaItem } from "../types";
import { toast } from "sonner";

// Standard CRC-32 lookup table
const crcTable = (() => {
 const table = new Uint32Array(256);
 for (let i = 0; i < 256; i++) {
 let c = i;
 for (let j = 0; j < 8; j++) {
 c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
 }
 table[i] = c;
 }
 return table;
})();

function computeCRC32(data: Uint8Array): number {
 let crc = 0xFFFFFFFF;
 for (let i = 0; i < data.length; i++) {
 crc = (crc >>> 8) ^ crcTable[(crc ^ data[i]) & 0xFF];
 }
 return (crc ^ 0xFFFFFFFF) >>> 0;
}

const textEncoder = new TextEncoder();
function stringToBytes(str: string): Uint8Array {
 return textEncoder.encode(str);
}

interface ZipEntry {
 filename: string;
 data: Uint8Array;
}

export function createZipArchive(entries: ZipEntry[]): Blob {
 const localHeaders: Uint8Array[] = [];
 const centralHeaders: Uint8Array[] = [];
 let currentOffset = 0;

 for (const entry of entries) {
 const filenameBytes = stringToBytes(entry.filename);
 const fileData = entry.data;
 const crc = computeCRC32(fileData);
 const size = fileData.length;

 // Local file header (30 bytes + filename)
 const localHeader = new Uint8Array(30 + filenameBytes.length);
 const localView = new DataView(localHeader.buffer);

 localView.setUint32(0, 0x04034b50, true);
 localView.setUint16(4, 10, true);
 localView.setUint16(6, 0x0800, true);
 localView.setUint16(8, 0, true);
 localView.setUint16(10, 0, true);
 localView.setUint16(12, 0, true);
 localView.setUint32(14, crc, true);
 localView.setUint32(18, size, true);
 localView.setUint32(22, size, true);
 localView.setUint16(26, filenameBytes.length, true);
 localView.setUint16(28, 0, true);
 localHeader.set(filenameBytes, 30);

 localHeaders.push(localHeader);
 localHeaders.push(fileData);

 // Central directory header (46 bytes + filename)
 const centralHeader = new Uint8Array(46 + filenameBytes.length);
 const centralView = new DataView(centralHeader.buffer);

 centralView.setUint32(0, 0x02014b50, true);
 centralView.setUint16(4, 20, true);
 centralView.setUint16(6, 10, true);
 centralView.setUint16(8, 0x0800, true);
 centralView.setUint16(10, 0, true);
 centralView.setUint16(12, 0, true);
 centralView.setUint16(14, 0, true);
 centralView.setUint32(16, crc, true);
 centralView.setUint32(20, size, true);
 centralView.setUint32(24, size, true);
 centralView.setUint16(28, filenameBytes.length, true);
 centralView.setUint16(30, 0, true);
 centralView.setUint16(32, 0, true);
 centralView.setUint16(34, 0, true);
 centralView.setUint16(36, 0, true);
 centralView.setUint32(38, 0, true);
 centralView.setUint32(42, currentOffset, true);
 centralHeader.set(filenameBytes, 46);

 centralHeaders.push(centralHeader);
 currentOffset += 30 + filenameBytes.length + size;
 }

 const centralDirectoryOffset = currentOffset;
 let centralDirectorySize = 0;
 for (const cb of centralHeaders) {
 centralDirectorySize += cb.length;
 }

 // End of Central Directory
 const eocd = new Uint8Array(22);
 const eocdView = new DataView(eocd.buffer);

 eocdView.setUint32(0, 0x06054b50, true);
 eocdView.setUint16(4, 0, true);
 eocdView.setUint16(6, 0, true);
 eocdView.setUint16(8, entries.length, true);
 eocdView.setUint16(10, entries.length, true);
 eocdView.setUint32(12, centralDirectorySize, true);
 eocdView.setUint32(16, centralDirectoryOffset, true);
 eocdView.setUint16(20, 0, true);

 const blobParts: BlobPart[] = [];
 for (const h of localHeaders) blobParts.push(h as unknown as BlobPart);
 for (const c of centralHeaders) blobParts.push(c as unknown as BlobPart);
 blobParts.push(eocd as unknown as BlobPart);

 return new Blob(blobParts, { type: "application/zip" });
}

export async function downloadBatchAsZip(items: MediaItem[]): Promise<void> {
 if (items.length === 0) return;

 const MAX_PART_SIZE = 500 * 1024 * 1024; // 500 MB

 const parts: MediaItem[][] = [];
 let currentPart: MediaItem[] = [];
 let currentPartSize = 0;

 for (const item of items) {
 const size = item.size || 0;
 if (currentPart.length > 0 && currentPartSize + size > MAX_PART_SIZE) {
 parts.push(currentPart);
 currentPart = [item];
 currentPartSize = size;
 } else {
 currentPart.push(item);
 currentPartSize += size;
 }
 }
 if (currentPart.length > 0) {
 parts.push(currentPart);
 }

 const dateStr = new Date().toISOString().split("T")[0];
 const toastId = toast.loading(`Preparing download of ${items.length} items...`);

 try {
 for (let partIdx = 0; partIdx < parts.length; partIdx++) {
 const partItems = parts[partIdx];
 toast.loading(`Downloading & packing part ${partIdx + 1} of ${parts.length}...`, { id: toastId });

 const fetchItem = async (item: MediaItem): Promise<ZipEntry | null> => {
 try {
 const res = await fetch(`/api/media/${item.filePath}`);
 if (!res.ok) throw new Error(`HTTP ${res.status}`);
 const buffer = await res.arrayBuffer();
 const filename = item.title || item.filePath.split("/").pop() || "asset";
 return {
 filename,
 data: new Uint8Array(buffer),
 };
 } catch {
 toast.error(`Failed to download: ${item.title}`);
 return null;
 }
 };

 const results = await Promise.all(partItems.map(fetchItem));
 const validEntries = results.filter((r): r is ZipEntry => r !== null);

 if (validEntries.length === 0) continue;

 const zipBlob = createZipArchive(validEntries);
 const url = URL.createObjectURL(zipBlob);
 const a = document.createElement("a");
 a.href = url;
 a.download = parts.length === 1 
 ? `prism_download_${dateStr}.zip`
 : `prism_download_${dateStr}_part${partIdx + 1}.zip`;

 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);

 await new Promise((resolve) => setTimeout(resolve, 500));
 setTimeout(() => URL.revokeObjectURL(url), 10000);
 }

 toast.success("Batch download started successfully", { id: toastId });
 } catch {
 toast.error("Batch download failed", { id: toastId });
 }
}
