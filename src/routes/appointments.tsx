import { createFileRoute, redirect } from "@tanstack/react-router";
import { pageHead } from "@/lib/public-content";
// No private component, data loader or legacy-store import exists on this leaf.
export const Route = createFileRoute("/appointments")({ head: () => pageHead("Appointments", "Staff-only Apex Legal Partners access.", true), beforeLoad: () => { throw redirect({ to: "/auth", replace: true }); } });
