import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function signToken(payload: Record<string, unknown>, expiresIn: string) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresIn)
    .sign(secret);
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

export async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return false;
  const payload = await verifyToken(token);
  return payload?.role === "admin";
}

export async function verifyGalleryAccess(slug: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("gallery_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.slug !== slug) return null;
  return payload as { galleryId: string; slug: string };
}
