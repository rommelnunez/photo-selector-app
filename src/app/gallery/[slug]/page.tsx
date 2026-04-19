import { supabase } from "@/lib/supabase";
import type { Metadata } from "next";
import GalleryClient from "./GalleryClient";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { data: gallery } = await supabase
    .from("galleries")
    .select("name, cover_url")
    .eq("slug", slug)
    .single();

  if (!gallery) {
    return { title: "Gallery Not Found" };
  }

  return {
    title: gallery.name,
    openGraph: {
      title: gallery.name,
      images: gallery.cover_url ? [gallery.cover_url] : [],
    },
  };
}

export default async function GalleryPage({ params }: Props) {
  const { slug } = await params;

  const { data: gallery } = await supabase
    .from("galleries")
    .select("name, slug, cover_url")
    .eq("slug", slug)
    .single();

  if (!gallery) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-text-secondary">Gallery not found</p>
      </div>
    );
  }

  return <GalleryClient gallery={gallery} />;
}
