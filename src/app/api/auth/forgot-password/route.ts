import { NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import prisma from "@/lib/prisma";
import { sendMail, renderEmail, isMailerConfigured } from "@/lib/mailer";

/**
 * POST /api/auth/forgot-password
 *
 * Body: { email: string }
 *
 * Always returns 200 with a generic message — we do NOT confirm whether
 * the email exists in our database, to prevent user enumeration. The
 * actual email is sent only if the address belongs to a real account.
 *
 * The reset token is a 32-byte random URL-safe string. We store only its
 * SHA-256 hash in the DB so a leaked DB snapshot can't be used to log in.
 */
export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return NextResponse.json({ error: "Format email tidak valid" }, { status: 400 });
    }

    if (!isMailerConfigured()) {
      return NextResponse.json({
        error: "Layanan email belum diatur oleh admin. Hubungi developer untuk reset kata sandi manual.",
      }, { status: 503 });
    }

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      select: { id: true, fullName: true, status: true },
    });

    // Privacy: respond identically whether the user exists or not.
    if (!user || user.status === "INACTIVE" || user.status === "TERMINATED") {
      return NextResponse.json({
        message: "Jika email terdaftar, kami sudah kirim link reset kata sandi ke kotak masuk Anda.",
      });
    }

    // 1-hour validity. Plain token goes in the email; hash goes to the DB.
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { resetTokenHash: tokenHash, resetTokenExpiresAt: expiresAt },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const link = `${appUrl.replace(/\/$/, "")}/reset-password/${rawToken}`;

    try {
      await sendMail({
        to: cleanEmail,
        subject: "Reset Kata Sandi Kimaya Management",
        html: renderEmail({
          title: "Reset Kata Sandi",
          preheader: "Link reset kata sandi Anda berlaku 1 jam.",
          bodyHtml: `
            <p>Hai <strong>${user.fullName}</strong>,</p>
            <p>Kami menerima permintaan untuk mereset kata sandi akun Anda. Klik tombol di bawah untuk membuat kata sandi baru:</p>
            <p style="text-align:center;margin:28px 0;">
              <a href="${link}"
                 style="display:inline-block;padding:14px 28px;border-radius:10px;background:#4A5D23;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;">
                Reset Kata Sandi
              </a>
            </p>
            <p style="font-size:12px;color:#7a6a5a;">
              Atau salin link berikut ke browser:<br>
              <code style="background:#f4f0e8;padding:6px 8px;border-radius:6px;word-break:break-all;font-size:11px;display:inline-block;margin-top:4px;">${link}</code>
            </p>
            <p style="font-size:12px;color:#9a8b7a;margin-top:24px;">
              Link ini berlaku selama <strong>1 jam</strong>. Jika tidak digunakan dalam waktu tersebut, Anda perlu meminta link baru.
            </p>
            <p style="font-size:12px;color:#9a8b7a;">
              Jika Anda tidak meminta reset kata sandi, abaikan email ini — kata sandi Anda tidak akan berubah.
            </p>`,
        }),
        text: `Hai ${user.fullName}, link reset kata sandi: ${link} (berlaku 1 jam).`,
      });
    } catch (mailErr) {
      console.error("[ForgotPassword] mail send failed:", mailErr);
      // Don't expose mail errors to attackers — still return the generic message.
    }

    return NextResponse.json({
      message: "Jika email terdaftar, kami sudah kirim link reset kata sandi ke kotak masuk Anda.",
    });
  } catch (error) {
    console.error("[ForgotPassword]", error);
    return NextResponse.json({ error: "Terjadi kesalahan, coba lagi nanti" }, { status: 500 });
  }
}
