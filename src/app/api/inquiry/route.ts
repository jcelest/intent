import { NextResponse } from "next/server";
import { addSubmission } from "@/lib/form-store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, phone, trade, message, source } = body;

    if (!name?.trim() || !email?.trim() || !phone?.trim()) {
      return NextResponse.json(
        { error: "Name, email, and phone are required" },
        { status: 400 }
      );
    }

    const submission = addSubmission({
      name: String(name).trim(),
      email: String(email).trim(),
      phone: String(phone).trim(),
      trade: trade ? String(trade).trim() : undefined,
      message: message ? String(message).trim() : undefined,
      source: source ? String(source).trim() : undefined,
    });

    // Send email if Resend is configured
    const resendApiKey = process.env.RESEND_API_KEY;
    const notifyEmails = [
      process.env.INQUIRY_NOTIFY_EMAIL,
      process.env.INQUIRY_NOTIFY_EMAIL_2,
    ].filter((e): e is string => !!e?.trim());

    if (resendApiKey && notifyEmails.length > 0) {
      try {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL || "Intent <onboarding@resend.dev>",
            to: notifyEmails,
            subject: `New inquiry from ${submission.name} — Intent`,
            html: `
              <h2>New Inquiry</h2>
              <p><strong>Name:</strong> ${submission.name}</p>
              <p><strong>Email:</strong> ${submission.email}</p>
              <p><strong>Phone:</strong> ${submission.phone}</p>
              ${submission.trade ? `<p><strong>Trade:</strong> ${submission.trade}</p>` : ""}
              ${submission.message ? `<p><strong>Message:</strong><br>${submission.message}</p>` : ""}
              ${submission.source ? `<p><strong>Source:</strong> ${submission.source}</p>` : ""}
              <p><em>Received at ${submission.createdAt}</em></p>
            `,
          }),
        });

        if (!emailRes.ok) {
          console.error("Resend error:", await emailRes.text());
        }
      } catch (err) {
        console.error("Email send error:", err);
      }
    }

    return NextResponse.json({ ok: true, id: submission.id });
  } catch (err) {
    console.error("Inquiry API error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
