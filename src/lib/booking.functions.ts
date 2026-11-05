import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { appointmentHoldSchema, appointmentRequestSchema, bookingRequestSchema, friendlyBookingError, holdSchema } from "./booking-schema";

/** Public booking endpoint: validates input, applies bot checks, then saves through the transactional database function. */
export const submitBooking = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => bookingRequestSchema.parse(data))
  .handler(async ({ data }) => {
    // Honeypot and minimum fill time: bots fill hidden fields and submit instantly.
    if (data.website || Date.now() - data.startedAt < 3000) {
      return { ok: false as const, code: "BOT", message: "We couldn't submit your request. Please try again." };
    }
    const ip = getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const args = {
      _client_key: `book:${ip}`, _name: data.name, _phone: data.phone, _email: data.email,
      _location: data.locationId, _service: data.serviceId, _advocate: data.advocateId, _start: data.startsAt,
      _opposing: data.opposingParty, _matter: data.matterDescription, _consent: data.consent,
    };
    const { data: rows, error } = data.holdToken
      ? await supabaseAdmin.rpc("submit_held_booking", { ...args, _hold_token: data.holdToken })
      : await supabaseAdmin.rpc("create_public_booking", args);
    if (error || !rows?.[0]) {
      if (error) console.error("[booking] rejected", error.message);
      return { ok: false as const, ...friendlyBookingError(error) };
    }
    const row = rows[0];
    const { notifyNewBooking } = await import("./notifications.server");
    await notifyNewBooking({ appointmentId: row.appointment_id, bookingRef: row.booking_ref, clientEmail: data.email, clientPhone: data.phone, clientName: data.name, startsAt: data.startsAt });
    return { ok: true as const, bookingRef: row.booking_ref, accessToken: row.access_token };
  });

export const holdBookingSlot = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => holdSchema.parse(input))
  .handler(async ({ data }) => {
    if (data.website || Date.now() - data.startedAt < 1000) {
      return { ok: false as const, message: "Please try selecting a time again." };
    }
    const ip = getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("acquire_booking_hold", {
      _client_key: ip, _location: data.locationId, _service: data.serviceId,
      // SQL NULL selects the first eligible advocate; generated RPC types omit nullability.
      _advocate: data.advocateId ?? (null as unknown as string), _start: data.startsAt, _previous_token: data.previousToken,
    });
    const row = rows?.[0];
    if (error || !row?.ok || !row.token || !row.advocate_id || !row.expires_at) {
      return { ok: false as const, message: row?.message ?? "That time couldn't be reserved. Please choose another time." };
    }
    return { ok: true as const, token: row.token, advocateId: row.advocate_id, expiresAt: row.expires_at };
  });

export const reserveAppointmentTime = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => appointmentHoldSchema.parse(input))
  .handler(async ({ data }) => {
    if (data.website || Date.now() - data.startedAt < 1000) return { ok: false as const, message: "Please try selecting a time again." };
    const ip = getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("acquire_appointment_hold", {
      _client_key: ip, _location: data.locationId, _service: data.serviceId,
      _advocate: data.advocateId ?? (null as unknown as string), _start: data.startsAt,
      _mode: data.mode, _previous_token: data.previousToken,
    });
    const row = rows?.[0];
    if (error || !row?.ok || !row.token || !row.expires_at) return { ok: false as const, message: error ? friendlyBookingError(error).message : row?.message ?? "That time is no longer available. Please select another time." };
    return { ok: true as const, token: row.token, expiresAt: row.expires_at };
  });

export const confirmAppointment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => appointmentRequestSchema.parse(input))
  .handler(async ({ data }) => {
    if (data.website || Date.now() - data.startedAt < 3000) return { ok: false as const, code: "BOT", message: "We couldn't submit your request. Please try again." };
    const ip = getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("submit_appointment_booking", {
      _hold_token: data.holdToken, _client_key: `book:${ip}`, _name: data.name, _phone: data.phone, _email: data.email,
      _location: data.locationId, _service: data.serviceId, _advocate: data.advocateId ?? (null as unknown as string),
      _start: data.startsAt, _mode: data.mode, _consent: data.consent,
    });
    const row = rows?.[0];
    if (error || !row) return { ok: false as const, ...friendlyBookingError(error) };
    const { notifyNewBooking } = await import("./notifications.server");
    await notifyNewBooking({ appointmentId: row.appointment_id, bookingRef: row.booking_ref, clientEmail: data.email, clientPhone: data.phone, clientName: data.name, startsAt: data.startsAt });
    return { ok: true as const, bookingRef: row.booking_ref, accessToken: row.access_token, advocateId: row.assigned_advocate_id, fee: row.consultation_fee };
  });
