import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession, createSession, setSessionCookie } from "@/lib/auth";

const MAX_AVATAR_BYTES = 2_000_000; // ~2MB base64 (≈ 1.45MB binary)

/**
 * PUT /api/auth/profile
 *
 * Self-service profile edit available to ALL roles. Allows the user to
 * change their own:
 *   - fullName, phone, address  (always)
 *   - avatarUrl                 (base64 data URL, optional)
 *
 * After save we refresh the session cookie so the new fullName / avatarUrl
 * shows up in the header without a full re-login.
 */
export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Anda belum masuk" }, { status: 401 });

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (typeof body.fullName === "string") {
      const v = body.fullName.trim();
      if (v.length < 2) return NextResponse.json({ error: "Nama minimal 2 karakter" }, { status: 400 });
      if (v.length > 200) return NextResponse.json({ error: "Nama terlalu panjang" }, { status: 400 });
      updates.fullName = v;
    }
    if (typeof body.phone === "string") {
      const v = body.phone.trim();
      // Allow empty (to clear). Otherwise validate basic format.
      if (v.length > 0 && !/^[+0-9 ()-]{8,20}$/.test(v)) {
        return NextResponse.json({ error: "Nomor HP tidak valid" }, { status: 400 });
      }
      updates.phone = v.length > 0 ? v : null;
    }
    if (typeof body.address === "string") {
      updates.address = body.address.trim().slice(0, 500) || null;
    }
    if (typeof body.avatarUrl === "string") {
      const v = body.avatarUrl;
      if (v.length === 0) {
        updates.avatarUrl = null;
      } else if (!v.startsWith("data:image/")) {
        return NextResponse.json({ error: "Foto profil harus berupa data URL gambar" }, { status: 400 });
      } else if (v.length > MAX_AVATAR_BYTES) {
        return NextResponse.json({ error: "Foto profil terlalu besar — maksimal sekitar 1.5MB" }, { status: 400 });
      } else {
        updates.avatarUrl = v;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Tidak ada perubahan untuk disimpan" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: session.id },
      data: updates,
      select: {
        id: true, email: true, fullName: true, role: true,
        departmentId: true, locationId: true, avatarUrl: true, facePhotoUrl: true,
      },
    });

    // Re-issue session so the header / sidebar shows new name. Photos are
    // intentionally NOT in the JWT — they're fetched fresh from /api/auth/me
    // (DB) so the cookie stays under the 4 KB browser limit.
    const newToken = await createSession({
      id: updated.id, email: updated.email, fullName: updated.fullName, role: updated.role,
      departmentId: updated.departmentId || undefined,
      locationId: updated.locationId || undefined,
    });
    await setSessionCookie(newToken);

    return NextResponse.json({ message: "Profil berhasil diperbarui", user: updated });
  } catch (error) {
    console.error("[Profile PUT]", error);
    return NextResponse.json({ error: "Gagal menyimpan profil" }, { status: 500 });
  }
}
