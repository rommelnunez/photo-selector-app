import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth";
import { put } from "@vercel/blob";

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File;
  const galleryId = formData.get("galleryId") as string;

  if (!file || !galleryId) {
    return NextResponse.json({ error: "Missing file or galleryId" }, { status: 400 });
  }

  const blob = await put(`galleries/${galleryId}/${file.name}`, file, {
    access: "public",
  });

  return NextResponse.json({ url: blob.url });
}
