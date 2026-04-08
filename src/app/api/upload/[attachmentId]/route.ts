import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { eq } from "drizzle-orm";
import { attachments } from "@/server/db/schema";

const UPLOAD_DIR = path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "./uploads");

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  const { attachmentId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const attachment = await db.query.attachments.findFirst({
    where: eq(attachments.id, attachmentId),
  });
  if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (attachment.uploadedBy !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Delete file from disk (ignore if already missing)
  const fullPath = path.join(UPLOAD_DIR, attachment.storagePath);
  await fs.unlink(fullPath).catch(() => undefined);

  // Delete DB record
  await db.delete(attachments).where(eq(attachments.id, attachmentId));

  return new NextResponse(null, { status: 204 });
}
