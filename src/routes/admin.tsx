import { createFileRoute, redirect } from "@tanstack/react-router";
import { pageHead } from "@/lib/public-content";
// No private component, data loader or legacy-store import exists on this leaf.
export const Route = createFileRoute("/admin")({ head: () => pageHead("Legacy Firm Settings", "Staff-only Apex Legal Partners access.", true), beforeLoad: () => { throw redirect({ to: "/auth", replace: true }); } });
