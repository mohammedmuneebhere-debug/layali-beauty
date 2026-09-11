import { CONTACT_EMAIL } from '@/lib/constants';

type OrderEmailPayload = {
  to: string;
  customerName: string;
  orderId: string;
  totalAmount: number;
  deliveryFee: number;
  items: { name: string; quantity: number; price: number }[];
  shippingAddress?: string;
  type: 'confirmed' | 'delivered';
};

function formatSar(amount: number) {
  return `${amount.toFixed(2)} SAR`;
}

function buildHtml(payload: OrderEmailPayload) {
  const shortId = payload.orderId.slice(0, 8).toUpperCase();
  const itemsRows = payload.items
    .map(
      (item) =>
        `<tr>
          <td style="padding:8px 0;color:#333;">${item.name} × ${item.quantity}</td>
          <td style="padding:8px 0;text-align:right;color:#333;">${formatSar(item.price * item.quantity)}</td>
        </tr>`
    )
    .join('');

  if (payload.type === 'confirmed') {
    return `
      <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;background:#0a0a0a;color:#fff;padding:32px;border-radius:16px;">
        <p style="letter-spacing:0.3em;color:#e07a8a;font-size:12px;text-transform:uppercase;">Layali Beauty Store</p>
        <h1 style="font-size:28px;margin:12px 0 8px;">Order Confirmed</h1>
        <p style="color:#f5b4be;font-style:italic;margin:0 0 20px;">thank you, ${payload.customerName}</p>
        <p style="color:#ccc;line-height:1.6;">We've received your order <strong>#${shortId}</strong>. Our team will prepare your beauty order for Cash on Delivery.</p>
        <table style="width:100%;margin:24px 0;border-collapse:collapse;">${itemsRows}</table>
        <p style="color:#aaa;margin:0;">Delivery: ${formatSar(payload.deliveryFee)}</p>
        <p style="font-size:18px;margin:8px 0 0;"><strong>Total: ${formatSar(payload.totalAmount)}</strong></p>
        ${payload.shippingAddress ? `<p style="color:#888;margin-top:16px;font-size:13px;">Delivering to: ${payload.shippingAddress}</p>` : ''}
        <p style="color:#666;font-size:12px;margin-top:28px;">Questions? ${CONTACT_EMAIL}</p>
      </div>
    `;
  }

  return `
    <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;background:#0a0a0a;color:#fff;padding:32px;border-radius:16px;">
      <p style="letter-spacing:0.3em;color:#e07a8a;font-size:12px;text-transform:uppercase;">Layali Beauty Store</p>
      <h1 style="font-size:28px;margin:12px 0 8px;">Order Delivered</h1>
      <p style="color:#f5b4be;font-style:italic;margin:0 0 20px;">thank you for glowing with us</p>
      <p style="color:#ccc;line-height:1.6;">Your order <strong>#${shortId}</strong> has been delivered. We hope your new beauty finds bring you confidence and glow.</p>
      <p style="color:#ccc;line-height:1.6;margin-top:16px;">Thank you for choosing Layali — beauty essentials, curated for you.</p>
      <p style="color:#666;font-size:12px;margin-top:28px;">Need anything? ${CONTACT_EMAIL}</p>
    </div>
  `;
}

async function sendViaResend(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false as const, reason: 'RESEND_API_KEY missing' };

  const from = process.env.EMAIL_FROM || `Layali <${CONTACT_EMAIL}>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });

  if (!res.ok) {
    const text = await res.text();
    return { ok: false as const, reason: text };
  }
  return { ok: true as const };
}

async function sendViaSmtp(to: string, subject: string, html: string) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    return { ok: false as const, reason: 'SMTP credentials missing' };
  }

  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || `Layali <${user}>`,
    to,
    subject,
    html,
  });

  return { ok: true as const };
}

export async function sendOrderEmail(payload: OrderEmailPayload) {
  const shortId = payload.orderId.slice(0, 8).toUpperCase();
  const subject =
    payload.type === 'confirmed'
      ? `Order Confirmed #${shortId} — Layali`
      : `Order Delivered #${shortId} — Thank you from Layali`;
  const html = buildHtml(payload);

  const resend = await sendViaResend(payload.to, subject, html);
  if (resend.ok) return { sent: true, provider: 'resend' as const };

  const smtp = await sendViaSmtp(payload.to, subject, html);
  if (smtp.ok) return { sent: true, provider: 'smtp' as const };

  console.error('[email] failed', { resend: resend.reason, smtp: smtp.reason });
  return {
    sent: false,
    error: resend.reason || smtp.reason || 'No email provider configured',
  };
}
