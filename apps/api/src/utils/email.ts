import { Resend } from "resend";
import { env } from "@/config/env";

export const resend = new Resend(env.RESEND_API_KEY);

// ─── Layout helper ───────────────────────────────────────────────────────────

function shell(opts: {
  title: string;
  preheader: string;
  intro: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  outro?: string;
}) {
  return `
<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <span style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;">${escapeHtml(opts.preheader)}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;padding:40px 16px;">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="background:#fff;border-radius:14px;padding:40px 36px;max-width:560px;">
          <tr><td>
            <div style="font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#888;margin-bottom:18px;">useAcolhe</div>
            <h1 style="font-size:22px;margin:0 0 14px;color:#111;line-height:1.3;">${escapeHtml(opts.title)}</h1>
            <p style="font-size:15px;line-height:1.65;color:#3a3a3a;margin:0 0 14px;">${opts.intro}</p>
            <p style="font-size:15px;line-height:1.65;color:#3a3a3a;margin:0 0 28px;">${opts.body}</p>
            <a href="${opts.ctaUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:13px 24px;border-radius:9px;font-weight:600;font-size:15px;">${escapeHtml(opts.ctaLabel)}</a>
            <p style="font-size:13px;color:#777;margin:32px 0 0;line-height:1.6;">
              Se o botão não funcionar, copie e cole este link no navegador:<br>
              <a href="${opts.ctaUrl}" style="color:#2563eb;word-break:break-all;">${opts.ctaUrl}</a>
            </p>
            ${opts.outro ? `<p style="font-size:12px;color:#999;margin:24px 0 0;line-height:1.6;">${opts.outro}</p>` : ""}
          </td></tr>
        </table>
        <div style="font-size:11px;color:#aaa;margin-top:18px;letter-spacing:.05em;">© ${new Date().getFullYear()} useAcolhe</div>
      </td></tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ─── Public senders ──────────────────────────────────────────────────────────

type InvitationEmailParams = {
  to: string;
  inviterName: string;
  organizationName: string;
  inviteUrl: string;
};

export function sendOrganizationInvitationEmail(p: InvitationEmailParams) {
  return resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: p.to,
    subject: `${p.inviterName} convidou você para ${p.organizationName}`,
    html: shell({
      title: `Você foi convidado para ${escapeHtml(p.organizationName)}`,
      preheader: `${p.inviterName} te convidou`,
      intro: `<strong>${escapeHtml(p.inviterName)}</strong> te convidou para participar da organização <strong>${escapeHtml(p.organizationName)}</strong> no useAcolhe.`,
      body: `Para aceitar, clique no botão abaixo. O convite expira em 48 horas.`,
      ctaLabel: "Aceitar convite",
      ctaUrl: p.inviteUrl,
      outro: "Se você não esperava este convite, pode ignorar com segurança.",
    }),
  });
}

type ResetPasswordParams = {
  to: string;
  userName?: string | null;
  resetUrl: string;
};

export function sendResetPasswordEmail(p: ResetPasswordParams) {
  return resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: p.to,
    subject: "Redefinir sua senha — useAcolhe",
    html: shell({
      title: "Redefinir sua senha",
      preheader: "Recebemos um pedido para redefinir sua senha.",
      intro: p.userName
        ? `Olá <strong>${escapeHtml(p.userName)}</strong>, recebemos um pedido para redefinir sua senha.`
        : `Recebemos um pedido para redefinir a senha da sua conta.`,
      body: `Clique no botão abaixo para criar uma nova senha. Por segurança, este link expira em 1 hora.`,
      ctaLabel: "Redefinir senha",
      ctaUrl: p.resetUrl,
      outro:
        "Se você não solicitou esta redefinição, pode ignorar este e-mail — sua senha continuará a mesma.",
    }),
  });
}

type VerifyEmailParams = {
  to: string;
  userName?: string | null;
  verifyUrl: string;
};

export function sendVerifyEmail(p: VerifyEmailParams) {
  return resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: p.to,
    subject: "Confirme seu e-mail — useAcolhe",
    html: shell({
      title: "Confirme seu e-mail",
      preheader: "Falta só um passo para ativar sua conta.",
      intro: p.userName
        ? `Bem-vindo, <strong>${escapeHtml(p.userName)}</strong>! Falta só confirmar seu e-mail para ativar a conta.`
        : `Bem-vindo ao useAcolhe! Falta só confirmar seu e-mail para ativar a conta.`,
      body: `Clique no botão abaixo para confirmar seu endereço de e-mail.`,
      ctaLabel: "Confirmar e-mail",
      ctaUrl: p.verifyUrl,
    }),
  });
}
