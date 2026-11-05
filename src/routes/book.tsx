import { createFileRoute, redirect } from "@tanstack/react-router";
import { pageHead } from "@/lib/public-content";
export const Route = createFileRoute("/book")({ head: () => pageHead("Book a Consultation", "Book a consultation with Apex Legal Partners."), beforeLoad: () => { throw redirect({ to: "/", replace: true }); } });
