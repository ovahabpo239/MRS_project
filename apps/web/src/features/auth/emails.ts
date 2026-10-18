import { siteConfig } from "@/config/site";
import type { Mail } from "@/server/mail/send";

type Draft = Omit<Mail, "to">;

function layout(heading: string, body: string, action?: { label: string; url: string }): string {
  const button = action
    ? `<p style="margin:24px 0"><a href="${action.url}" style="background:#00dbe9;color:#00363a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">${action.label}</a></p>
       <p style="color:#555;font-size:13px">If the button does not work, copy this link into your browser:<br>${action.url}</p>`
    : "";
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#1a1b20;max-width:520px;margin:0 auto;padding:24px">
    <h1 style="font-size:20px">${heading}</h1><p>${body}</p>${button}
    <p style="color:#777;font-size:12px;margin-top:32px">${siteConfig.name}</p></body></html>`;
}

/** `url` is built from a base64url token and our own origin, so it needs no HTML escaping. */
export function verificationEmail(url: string): Draft {
  return {
    subject: `Confirm your email for ${siteConfig.name}`,
    text: `Confirm your email address to finish creating your account:\n\n${url}\n\nThe link is valid for 24 hours. If you did not sign up, ignore this email.`,
    html: layout(
      "Confirm your email",
      "Confirm your email address to finish creating your account. The link is valid for 24 hours. If you did not sign up, you can ignore this email.",
      { label: "Confirm email", url },
    ),
  };
}

/** `url` is built from a base64url token and our own origin, so it needs no HTML escaping. */
export function passwordResetEmail(url: string): Draft {
  return {
    subject: `Reset your ${siteConfig.name} password`,
    text: `Someone (hopefully you) asked to reset the password for this account. Choose a new one here:\n\n${url}\n\nThe link is valid for 1 hour and works once. If you did not ask for this, ignore this email: your password has not changed.`,
    html: layout(
      "Reset your password",
      "Someone (hopefully you) asked to reset the password for this account. The link is valid for 1 hour and works once. If you did not ask for this, ignore this email: your password has not changed.",
      { label: "Choose a new password", url },
    ),
  };
}

/** Security notice: lets the owner react if someone else changed the password. */
export function passwordChangedEmail(): Draft {
  const contact = siteConfig.email;
  return {
    subject: `Your ${siteConfig.name} password was changed`,
    text: `The password for your account was just changed, and other devices were signed out.\n\nIf this was you, no action is needed. If it was not you, please contact ${contact} right away.`,
    html: layout(
      "Your password was changed",
      `The password for your account was just changed, and other devices were signed out. If this was you, no action is needed. If it was not you, please contact <a href="mailto:${contact}">${contact}</a> right away.`,
    ),
  };
}

/** Sent instead of a second welcome when someone registers an address that already has an account. */
export function alreadyRegisteredEmail(loginUrl: string): Draft {
  return {
    subject: `You already have an account on ${siteConfig.name}`,
    text: `Someone (hopefully you) tried to sign up with this email address, but it already has an account.\n\nSign in here: ${loginUrl}\n\nIf it was not you, no action is needed.`,
    html: layout(
      "You already have an account",
      "Someone (hopefully you) tried to sign up with this email address, but it already has an account. If it was not you, no action is needed.",
      { label: "Sign in", url: loginUrl },
    ),
  };
}
