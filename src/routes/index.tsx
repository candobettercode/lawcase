import { createFileRoute } from "@tanstack/react-router";
import { BookingFoundation } from "@/components/booking/BookingFoundation";
import { pageHead } from "@/lib/public-content";
import { bookingDirectoryOptions } from "@/hooks/use-booking-availability";
export const Route = createFileRoute("/")({
  head: () => pageHead("Book an Appointment", "Schedule a consultation with an Apex Legal Partners advocate at your preferred date, time and location."),
  loader: ({ context }) => context.queryClient.ensureQueryData(bookingDirectoryOptions),
  component: BookingFoundation,
  errorComponent: () => <div role="alert" className="page-gutter py-10">Booking details couldn't be loaded. Please refresh or contact us.</div>,
  notFoundComponent: () => <div className="page-gutter py-10">Booking is unavailable. Please contact us.</div>,
});
