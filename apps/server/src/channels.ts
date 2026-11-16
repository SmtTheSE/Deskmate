import nodemailer from 'nodemailer';
import type { TestResult } from '@deskmate/core';

/**
 * Outgoing channels. Incoming messages arrive through the webhook routes.
 * Each channel has a test() so the setup wizard can show "Connected" or a
 * plain-language reason it failed.
 */

export interface EmailConfig { smtpHost?: string; smtpPort?: number; smtpUser?: string; smtpPass?: string; fromAddress?: string }
export interface TwilioConfig { accountSid?: string; authToken?: string; smsNumber?: string; whatsappNumber?: string }

function transport(c: EmailConfig) {
  const port = Number(c.smtpPort) || 587;
  return nodemailer.createTransport({
    host: c.smtpHost,
    port,
    secure: port === 465,
    auth: c.smtpUser ? { user: c.smtpUser, pass: c.smtpPass } : undefined,
    connectionTimeout: 10_000,
  });
}

export async function testEmail(c: EmailConfig): Promise<TestResult> {
  if (!c.smtpHost || !c.fromAddress) return { ok: false, message: 'Fill in the mail server and the "send from" address.' };
  try {
    await transport(c).verify();
    return { ok: true, message: `Signed in to ${c.smtpHost}. Replies will be sent from ${c.fromAddress}.` };
  } catch (e: any) {
    if (e?.code === 'EAUTH') return { ok: false, message: 'The mail server rejected the username or password. Some providers need an "app password".' };
    if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ESOCKET', 'ECONNECTION'].includes(e?.code)) return { ok: false, message: 'Could not reach the mail server. Check the server name and port.' };
    return { ok: false, message: String(e?.message ?? e) };
  }
}

export async function sendEmail(c: EmailConfig, to: string, subject: string, text: string) {
  await transport(c).sendMail({ from: c.fromAddress, to, subject, text });
}

const twilioAuth = (c: TwilioConfig) => `Basic ${Buffer.from(`${c.accountSid}:${c.authToken}`).toString('base64')}`;

export async function testTwilio(c: TwilioConfig): Promise<TestResult> {
  if (!c.accountSid || !c.authToken) return { ok: false, message: 'Paste your Account SID and Auth Token from the Twilio console.' };
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(c.accountSid)}.json`, {
      headers: { authorization: twilioAuth(c) }, signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 401) return { ok: false, message: 'Twilio did not accept the Account SID and Auth Token.' };
    if (!res.ok) return { ok: false, message: `Twilio returned an error (${res.status}).` };
    const data: any = await res.json();
    return { ok: true, message: `Connected to the Twilio account "${data.friendly_name ?? c.accountSid}".` };
  } catch {
    return { ok: false, message: 'Could not reach Twilio. Check your internet connection.' };
  }
}

export async function sendTwilio(c: TwilioConfig, to: string, body: string) {
  const whatsapp = to.startsWith('whatsapp:');
  const from = whatsapp ? `whatsapp:${(c.whatsappNumber ?? '').replace(/^whatsapp:/, '')}` : c.smsNumber;
  if (!from) throw new Error(whatsapp ? 'No WhatsApp number is set up.' : 'No SMS number is set up.');
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(c.accountSid ?? '')}/Messages.json`, {
    method: 'POST',
    headers: { authorization: twilioAuth(c), 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: to, From: from, Body: body.slice(0, 1500) }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Twilio could not send the message (${res.status}).`);
}

/** Verify X-Twilio-Signature so only Twilio can post to the webhook. */
export async function validTwilioSignature(authToken: string, url: string, params: Record<string, string>, signature: string) {
  const { createHmac, timingSafeEqual } = await import('node:crypto');
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join('');
  const expected = createHmac('sha1', authToken).update(data).digest('base64');
  return expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
