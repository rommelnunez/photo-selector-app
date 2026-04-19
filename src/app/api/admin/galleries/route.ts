import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import bcrypt from "bcryptjs";

export async function GET() {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: galleries, error } = await supabase
    .from("galleries")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get photo counts per gallery
  const galleryIds = galleries.map((g: { id: string }) => g.id);
  const { data: photoCounts } = await supabase
    .from("photos")
    .select("gallery_id")
    .in("gallery_id", galleryIds);

  const countMap: Record<string, number> = {};
  photoCounts?.forEach((p: { gallery_id: string }) => {
    countMap[p.gallery_id] = (countMap[p.gallery_id] || 0) + 1;
  });

  const result = galleries.map((g: { id: string }) => ({
    ...g,
    photo_count: countMap[g.id] || 0,
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, slug, password } = await req.json();

  if (!name || !slug || !password) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const password_hash = await bcrypt.hash(password, 10);

  const { data, error } = await supabase
    .from("galleries")
    .insert({ name, slug, password_hash })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
