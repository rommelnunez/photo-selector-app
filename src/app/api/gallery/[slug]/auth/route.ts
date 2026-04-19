import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { signToken } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { password } = await req.json();

  const { data: gallery, error } = await supabase
    .from("galleries")
    .select("id, password_hash, slug")
    .eq("slug", slug)
    .single();

  if (error || !gallery) {
    return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
  }

  const valid = await bcrypt.compare(password, gallery.password_hash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = await signToken(
    { galleryId: gallery.id, slug: gallery.slug },
    "30d"
  );

  const res = NextResponse.json({ success: true });
  res.cookies.set("gallery_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  return res;
}
