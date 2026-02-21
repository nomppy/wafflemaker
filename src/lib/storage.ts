import fs from "fs";
import path from "path";

const STORAGE_DIR = path.join(process.cwd(), ".storage");

function ensureDir() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

export function saveAudio(key: string, buffer: Buffer) {
  ensureDir();
  fs.writeFileSync(path.join(STORAGE_DIR, key), buffer);
}

export function getAudio(key: string): Buffer | null {
  const filePath = path.join(STORAGE_DIR, key);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
}

export function deleteAudio(key: string) {
  const filePath = path.join(STORAGE_DIR, key);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}
