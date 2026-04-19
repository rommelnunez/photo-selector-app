import { NextRequest, NextResponse } from "next/server";
import { verifyGalleryAccess } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const access = await verifyGalleryAccess(slug);

  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: photos, error } = await supabase
    .from("photos")
    .select("*")
    .eq("gallery_id", access.galleryId)
    .order("position");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also fetch existing selections if any
  const { data: selections } = await supabase
    .from("selections")
    .select("photo_id, comment")
    .eq("gallery_id", access.galleryId);

  return NextResponse.json({
    photos: photos || [],
    selections: selections || [],
  });
}
