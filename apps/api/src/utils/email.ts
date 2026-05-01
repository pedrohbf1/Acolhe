import { Resend } from "resend";
import { env } from "@/config/env";

export const resend = new Resend(env.RESEND_API_KEY);

type InvitationEmailParams = {
  to: string;
  inviterName: string;
  organizationName: string;
  inviteUrl: string;
};

export async function sendOrganizationInvitationEmail({
  to,
  inviterName,
  organizationName,
  inviteUrl,
}: InvitationEmailParams) {
  const subject = `${inviterName} convidou você para ${organizationName} no useAcolhe`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
      <h1 style="font-size: 22px; margin: 0 0 16px;">Você foi convidado(a) para o useAcolhe</h1>
      <p style="font-size: 15px; line-height: 1.6; margin: 0 0 12px;">
        <strong>${escapeHtml(inviterName)}</strong> convidou você para participar da organização
        <strong>${escapeHtml(organizationName)}</strong>.
      </p>
      <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
        Clique no botão abaixo para aceitar o convite:
      </p>
      <a href="${inviteUrl}"
         style="display: inline-block; background: #111; color: #fff; text-decoration: none; padding: 12px 22px; border-radius: 8px; font-weight: 600;">
        Aceitar convite
      </a>
      <p style="font-size: 13px; color: #666; margin: 32px 0 0;">
        Se o botão não funcionar, copie e cole este link no navegador:<br />
        <a href="${inviteUrl}" style="color: #2563eb; word-break: break-all;">${inviteUrl}</a>
      </p>
      <p style="font-size: 12px; color: #888; margin: 24px 0 0;">
        Se você não esperava este convite, pode ignorar este e-mail.
      </p>
    </div>
  `;

  return resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to,
    subject,
    html,
  });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
