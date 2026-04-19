import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { del } from "@vercel/blob";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { data: gallery, error } = await supabase
    .from("galleries")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !gallery) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: photos } = await supabase
    .from("photos")
    .select("*")
    .eq("gallery_id", id)
    .order("position");

  return NextResponse.json({ ...gallery, photos: photos || [] });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Get all blob URLs to delete from storage
  const { data: photos } = await supabase
    .from("photos")
    .select("blob_url")
    .eq("gallery_id", id);

  // Delete blobs in batches
  if (photos && photos.length > 0) {
    const urls = photos.map((p: { blob_url: string }) => p.blob_url);
    try {
      await del(urls);
    } catch {
      // Continue even if blob deletion fails
    }
  }

  // Cascade deletes photos and selections
  const { error } = await supabase
    .from("galleries")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
