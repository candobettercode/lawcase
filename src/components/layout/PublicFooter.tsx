import { Link } from "@tanstack/react-router";
import { CompactFirmBrand } from "@/components/branding/FirmBrand";
export function PublicFooter() {
  return <footer className="page-gutter mt-auto grid gap-4 border-t bg-card py-6 text-xs text-muted-foreground sm:flex sm:items-center sm:justify-between">
    <CompactFirmBrand />
    <span>Booking a consultation does not create an attorney–client relationship.</span>
    <Link to="/contact" className="inline-flex min-h-11 items-center underline underline-offset-4">Contact the firm</Link>
  </footer>;
}