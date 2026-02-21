import { NextRequest, NextResponse } from "next/server";
import { createMagicLink } from "@/lib/auth";

function buildMagicLinkEmail(magicUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background-color:#fffbf0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fffbf0;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="420" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;border:2px solid #e8c47a;overflow:hidden;">
          <tr>
            <td style="background-color:#f5e6d0;padding:24px 32px;text-align:center;border-bottom:2px dashed #e8c47a;">
              <h1 style="margin:0;font-size:28px;color:#6b3a1f;font-weight:700;">&#129479; Wafflemaker</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:16px;color:#4a3520;line-height:1.5;">
                Hey there! Here's your magic link to sign in:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="${magicUrl}" style="display:inline-block;background-color:#c8913a;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:12px;border:2px solid #a0722c;">
                      Sign in to Wafflemaker
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:13px;color:#8a7560;line-height:1.5;">
                This link expires in 15 minutes. If you didn't request this, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;text-align:center;border-top:1px solid #f0e0c8;">
              <p style="margin:0 0 8px;font-size:12px;color:#b8a080;">
                Sent with warmth from Wafflemaker
              </p>
              <p style="margin:0;font-size:11px;color:#c8b090;">
                <a href="mailto:feedback@sunken.site?subject=Wafflemaker%20Feedback" style="color:#c8913a;text-decoration:none;">Send feedback</a>
                &nbsp;&middot;&nbsp;
                <a href="https://github.com/nomppy/wafflemaker" style="color:#c8913a;text-decoration:none;">GitHub</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendEmailViaResend(
  apiKey: string,
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Wafflemaker <noreply@sunken.site>",
        to,
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("Resend API error:", res.status, err);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Failed to send email via Resend:", err);
    return false;
  }
}

export async function POST(req: NextRequest) {
  const { email, redirect } = await req.json();

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const token = await createMagicLink(email);

  // Build magic URL with optional redirect
  const verifyUrl = new URL("/api/auth/verify", req.nextUrl.origin);
  verifyUrl.searchParams.set("token", token);
  if (redirect && typeof redirect === "string" && redirect.startsWith("/")) {
    verifyUrl.searchParams.set("redirect", redirect);
  }
  const magicUrl = verifyUrl.toString();

  console.log(`\n🧇 Magic link for ${email}: ${magicUrl}\n`);

  // Send email via Resend if API key is available
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    await sendEmailViaResend(
      resendKey,
      email,
      "Your Wafflemaker login link 🧇",
      buildMagicLinkEmail(magicUrl)
    );
  }

  return NextResponse.json({
    ok: true,
    // Include link when no RESEND_API_KEY (dev/testing)
    ...(!resendKey ? { magicUrl } : {}),
  });
}
