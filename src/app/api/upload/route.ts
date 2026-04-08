import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { eq, and } from "drizzle-orm";
import { trips, groupMembers, attachments } from "@/server/db/schema";

const UPLOAD_DIR = path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "./uploads");
const MAX_BYTES = parseInt(process.env.MAX_UPLOAD_SIZE_BYTES ?? "10485760", 10);
const ALLOWED_TYPES = (process.env.ALLOWED_MIME_TYPES ?? "image/jpeg,image/png,image/webp,application/pdf")
  .split(",")
  .map((s) => s.trim());

function ext(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "application/pdf": "pdf",
  };
  return map[mimeType] ?? "bin";
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  const tripId = formData.get("tripId");
  const itemId = formData.get("itemId"); // optional

  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (typeof tripId !== "string") return NextResponse.json({ error: "tripId required" }, { status: 400 });

  // Validate mime type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: `File type not allowed: ${file.type}` }, { status: 400 });
  }

  // Validate size
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `File too large (max ${MAX_BYTES / 1_048_576} MB)` }, { status: 400 });
  }

  // Verify trip membership
  const trip = await db.query.trips.findFirst({ where: eq(trips.id, tripId) });
  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

  const membership = await db.query.groupMembers.findFirst({
    where: and(
      eq(groupMembers.groupId, trip.groupId),
      eq(groupMembers.userId, session.user.id)
    ),
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Write file to disk
  const fileId = randomUUID();
  const filename = `${fileId}.${ext(file.type)}`;
  const tripDir = path.join(UPLOAD_DIR, tripId);
  await fs.mkdir(tripDir, { recursive: true });
  const storagePath = path.join(tripDir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(storagePath, buffer);

  // Insert DB record
  const [attachment] = await db
    .insert(attachments)
    .values({
      tripId,
      itineraryItemId: typeof itemId === "string" && itemId ? itemId : null,
      uploadedBy: session.user.id,
      filename: file.name,
      storagePath: `${tripId}/${filename}`, // relative to UPLOAD_DIR
      mimeType: file.type,
      sizeBytes: file.size,
    })
    .returning();

  return NextResponse.json(attachment, { status: 201 });
}
