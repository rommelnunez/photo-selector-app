import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { blobUrl, filename, position } = await req.json();

  const { data, error } = await supabase
    .from("photos")
    .insert({
      gallery_id: id,
      blob_url: blobUrl,
      filename,
      position,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Set cover_url if this is the first photo (position 0)
  if (position === 0) {
    await supabase
      .from("galleries")
      .update({ cover_url: blobUrl })
      .eq("id", id);
  }

  return NextResponse.json(data);
}
