import { NextRequest, NextResponse } from "next/server";
import { verifyGalleryAccess } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const access = await verifyGalleryAccess(slug);

  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { selections } = await req.json() as {
    selections: { photoId: string; comment?: string }[];
  };

  if (!selections || !Array.isArray(selections)) {
    return NextResponse.json({ error: "Invalid selections" }, { status: 400 });
  }

  // Delete previous selections
  await supabase
    .from("selections")
    .delete()
    .eq("gallery_id", access.galleryId);

  // Insert new selections
  if (selections.length > 0) {
    const rows = selections.map((s) => ({
      gallery_id: access.galleryId,
      photo_id: s.photoId,
      comment: s.comment || null,
    }));

    const { error } = await supabase.from("selections").insert(rows);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Update gallery status
  await supabase
    .from("galleries")
    .update({ status: "submitted" })
    .eq("id", access.galleryId);

  return NextResponse.json({ success: true, count: selections.length });
}
