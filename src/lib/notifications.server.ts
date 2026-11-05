/**
 * Notification service. The provider below is a stub that only logs to the server console;
 * replace `stubProvider` with a real email/SMS provider later. Messages never include the
 * nature of the legal matter, opposing party or matter description.
 */
export interface OutboundMessage { channel: "email" | "sms"; to: string; subject?: string; body: string }
export interface NotificationProvider { send(message: OutboundMessage): Promise<void> }

const stubProvider: NotificationProvider = {
  async send(m) { console.log(`[notifications:stub] ${m.channel} to ${m.to}: ${m.subject ? m.subject + " — " : ""}${m.body}`); },
};
let provider: NotificationProvider = stubProvider;
export function setNotificationProvider(p: NotificationProvider) { provider = p; }

export function bookingReceivedMessages(input: { bookingRef: string; clientName: string; clientEmail: string; clientPhone: string }): OutboundMessage[] {
  const body = `Hello ${input.clientName}, we received your consultation request ${input.bookingRef}. It is awaiting confirmation; we will contact you shortly.`;
  const messages: OutboundMessage[] = [{ channel: "sms", to: input.clientPhone, body: `Apex Legal Partners: request ${input.bookingRef} received, awaiting confirmation.` }];
  if (input.clientEmail) messages.unshift({ channel: "email", to: input.clientEmail, subject: `Request ${input.bookingRef} received`, body });
  return messages;
}

export async function notifyNewBooking(input: { appointmentId: string; bookingRef: string; clientName: string; clientEmail: string; clientPhone: string; startsAt: string }) {
  // In-app notifications for staff and the assigned advocate are created in the same database transaction as the booking.
  for (const m of bookingReceivedMessages(input)) {
    try { await provider.send(m); } catch (e) { console.error("[notifications] send failed", e); }
  }
}
