/**
 * Dev file server — streams uploaded files from UPLOAD_DIR.
 * In production, Nginx serves /uploads/ directly from the volume.
 * This route handles it transparently so the same URL works everywhere.
 */
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

const UPLOAD_DIR = path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "./uploads");

const MIME_MAP: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  pdf: "application/pdf",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  // Prevent path traversal
  const relative = segments.map((s) => path.basename(s)).join("/");
  const fullPath = path.join(UPLOAD_DIR, relative);

  let data: Buffer;
  try {
    data = await fs.readFile(fullPath);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  const extension = fullPath.split(".").pop()?.toLowerCase() ?? "";
  const contentType = MIME_MAP[extension] ?? "application/octet-stream";

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
