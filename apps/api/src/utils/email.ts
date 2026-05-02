import { Resend } from "resend";
import { env } from "@/config/env";

export const resend = new Resend(env.RESEND_API_KEY);

/**
 * Resend não joga exception em falha — retorna `{ data, error }`. Esse wrapper
 * normaliza pra que erros virem exception (e o controller responda 5xx com a
 * mensagem real, em vez de "ok" mascarado).
 */
async function send(options: Parameters<typeof resend.emails.send>[0]) {
  const result = await resend.emails.send(options);
  if (result.error) {
    const msg = result.error.message ?? "Falha ao enviar e-mail";
    console.error("[email] Resend error:", result.error);
    throw new Error(msg);
  }
  return result.data;
}

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
  return send({
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
  return send({
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

type FeedbackEmailParams = {
  to: string;
  fromUserName: string;
  fromUserEmail: string;
  type: string;
  subject: string;
  message: string;
};

export function sendFeedbackEmail(p: FeedbackEmailParams) {
  const safeMessage = escapeHtml(p.message).replace(/\n/g, "<br>");
  return send({
    from: env.RESEND_FROM_EMAIL,
    to: p.to,
    replyTo: p.fromUserEmail,
    subject: `[Feedback ${p.type}] ${p.subject}`,
    html: `
<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;padding:40px 16px;">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="background:#fff;border-radius:14px;padding:32px 36px;max-width:560px;">
          <tr><td>
            <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#888;margin-bottom:14px;">useAcolhe · feedback</div>
            <span style="display:inline-block;padding:4px 10px;border-radius:6px;background:#111;color:#fff;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">${escapeHtml(p.type)}</span>
            <h1 style="font-size:20px;margin:14px 0 6px;color:#111;line-height:1.3;">${escapeHtml(p.subject)}</h1>
            <p style="font-size:13px;color:#666;margin:0 0 22px;">de <strong>${escapeHtml(p.fromUserName)}</strong> &lt;${escapeHtml(p.fromUserEmail)}&gt;</p>
            <div style="font-size:15px;line-height:1.65;color:#222;background:#fafafa;border:1px solid #eee;border-radius:8px;padding:18px;">${safeMessage}</div>
            <p style="font-size:12px;color:#888;margin:24px 0 0;line-height:1.6;">Responda direto este e-mail para falar com o usuário.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`,
  });
}

type FeedbackThankYouParams = {
  to: string;
  userName: string;
  type: string;
  subject: string;
};

export function sendFeedbackThankYouEmail(p: FeedbackThankYouParams) {
  return send({
    from: env.RESEND_FROM_EMAIL,
    to: p.to,
    subject: "Recebemos seu feedback — useAcolhe",
    html: shell({
      title: "Obrigado pelo feedback!",
      preheader: `Recebemos seu ${p.type.toLowerCase()}: "${p.subject}"`,
      intro: `Olá <strong>${escapeHtml(p.userName)}</strong>, recebemos seu <strong>${escapeHtml(p.type.toLowerCase())}</strong> e leio pessoalmente cada mensagem.`,
      body: `Sobre <em>"${escapeHtml(p.subject)}"</em> — se for um caso que precisa de resposta, te chamo de volta neste e-mail nos próximos dias úteis. Sua opinião faz o useAcolhe melhor.`,
      ctaLabel: "Voltar ao app",
      ctaUrl: env.SITE_URL,
      outro: "Se quiser adicionar algo, é só responder este e-mail.",
    }),
  });
}

type VerifyEmailParams = {
  to: string;
  userName?: string | null;
  verifyUrl: string;
};

export function sendVerifyEmail(p: VerifyEmailParams) {
  return send({
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
