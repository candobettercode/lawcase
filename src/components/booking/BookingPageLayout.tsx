import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FirmBrandPanel } from "@/components/branding/FirmBrand";

export function BookingPageLayout({ heading, children }: { heading?: ReactNode; children: ReactNode }) {
  return <div className="booking-page min-h-svh bg-background lg:grid lg:grid-cols-[minmax(0,17fr)_minmax(0,33fr)]">
    <FirmBrandPanel />
    <section aria-label="Appointment booking" className="booking-workspace min-w-0 lg:col-start-2">
      <div className="booking-workspace-inner px-4 pb-10 pt-4 sm:px-8 sm:pb-12 lg:px-9 lg:pt-5 xl:px-12 2xl:px-14">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-x-2 gap-y-3 sm:mb-4 sm:gap-x-4">
          <div className="min-w-0">{heading}</div>
          <Button asChild variant="outline" size="sm" className="h-10 shrink-0 gap-1.5 bg-card px-3 text-sm sm:h-11 sm:gap-2 sm:px-4"><Link to="/auth">Login <ArrowUpRight className="size-3.5" /></Link></Button>
        </div>
        <div className="@container/booking min-w-0">{children}</div>
      </div>
    </section>
  </div>;
}