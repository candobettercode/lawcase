import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
const holds: string[]=[]; const appointments: string[]=[];
let db: SupabaseClient; let location: string, service: string, advocate: string, start: string, day: string;
describe.skipIf(!url || !key)("month availability and transactional holds", () => {
 beforeAll(async () => {
  if (!url || !key) return;
  db=createClient(url,key,{ auth:{persistSession:false,autoRefreshToken:false} });
  const {data:s}=await db.from("services").select("id").eq("active",true).order("duration_minutes").limit(1).single(); if (!s) throw new Error("No active service for booking tests"); service=s.id;
  const {data:links}=await db.from("advocate_locations").select("advocate_id,location_id");
  for(let i=2;i<28 && !start;i++) { day=new Date(Date.now()+i*864e5).toISOString().slice(0,10); for(const link of links ?? []) { const {data}=await db.rpc("booking_day_slots",{_location:link.location_id,_service:service,_advocate:link.advocate_id,_date:day,_zone:"UTC"}); if(data?.length){location=link.location_id;advocate=link.advocate_id;start=data.at(-1).starts_at;break;} } }
  expect(start).toBeTruthy();
 });
 afterAll(async () => { if(appointments.length) await db.from("appointments").delete().in("id",appointments); if(holds.length) await db.from("booking_holds").delete().in("token_hash",holds); });
 const acquire=(id: string|null=advocate)=>db.rpc("acquire_booking_hold",{_client_key:crypto.randomUUID(),_location:location,_service:service,_advocate:id,_start:start});
 it("returns month highlights matching the day engine",async()=>{const {data,error}=await db.rpc("booking_month_availability",{_location:location,_service:service,_advocate:advocate,_month:day.slice(0,7)+"-01",_zone:"UTC"});expect(error).toBeNull();expect(data.find((r: {date:string})=>r.date===day).slot_count).toBeGreaterThan(0);});
 it("allows only one concurrent hold and hides that time from day slots",async()=>{const results=await Promise.all([acquire(),acquire()]);expect(results.filter((r)=>r.data?.[0].ok)).toHaveLength(1);const winner=results.find((r)=>r.data?.[0].ok)?.data?.[0];const hash=await hashToken(winner.token);holds.push(hash);const {data}=await db.rpc("booking_day_slots",{_location:location,_service:service,_advocate:advocate,_date:day,_zone:"UTC"});expect(data.some((s:{starts_at:string})=>Date.parse(s.starts_at)===Date.parse(start))).toBe(false);await db.from("booking_holds").update({expires_at:new Date(Date.now()-1000).toISOString()}).eq("token_hash",hash);});
 it("releases expired holds and assigns an eligible first-available advocate",async()=>{const {data,error}=await acquire(null);expect(error).toBeNull();expect(data[0].ok).toBe(true);const row=data[0];const hash=await hashToken(row.token);holds.push(hash);const {data:link}=await db.from("advocate_locations").select("advocate_id").eq("location_id",location).eq("advocate_id",row.advocate_id);expect(link).toHaveLength(1);const {data:settings}=await db.from("booking_settings").select("slot_hold_minutes").single();if (!settings) throw new Error("Missing booking settings"); expect(Math.abs(Date.parse(row.expires_at)-Date.now()-settings.slot_hold_minutes*60000)).toBeLessThan(10000);await db.from("booking_holds").update({expires_at:new Date(Date.now()-1000).toISOString()}).eq("token_hash",hash);const {error:expired}=await db.rpc("submit_held_booking",{_hold_token:row.token,_client_key:crypto.randomUUID(),_name:"Calendar QA",_phone:"+1 212 555 0199",_email:"calendar-qa@example.test",_location:location,_service:service,_advocate:row.advocate_id,_start:start,_opposing:"",_matter:"",_consent:true});expect(expired?.message).toContain("SLOT_UNAVAILABLE");});
});
async function hashToken(token:string){ const buffer=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token));return Array.from(new Uint8Array(buffer),v=>v.toString(16).padStart(2,"0")).join(""); }
