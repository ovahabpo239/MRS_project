import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { getServerEnv } from "@/lib/env";

export type Mail = { to: string; subject: string; text: string; html: string };

let transport: Transporter | undefined;

function getTransport(): Transporter {
  const env = getServerEnv();
  transport ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  });
  return transport;
}

/** Send one email. Throws if the SMTP server rejects it; callers decide how to recover. */
export async function sendMail(mail: Mail): Promise<void> {
  await getTransport().sendMail({ from: getServerEnv().MAIL_FROM, ...mail });
}
