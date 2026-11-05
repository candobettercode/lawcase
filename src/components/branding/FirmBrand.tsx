import logo from "@/assets/logo.png";
import courthouse from "@/assets/booking-courthouse.jpg";

export function FirmBrandPanel() {
  return (
    <aside aria-label="Masurkar Law Associates" className="booking-brand relative isolate overflow-hidden bg-header text-header-foreground lg:fixed lg:inset-y-0 lg:left-0 lg:w-[34%]">
      <img src={courthouse} alt="" width={1024} height={1536} fetchPriority="high" className="absolute inset-0 -z-10 size-full object-cover" />
      <div className="booking-brand-content flex h-full items-center justify-center px-7 py-8 sm:px-12 lg:px-12 lg:py-12 xl:px-16 xl:py-14">
        <div className="flex flex-col items-center justify-center gap-4 text-center sm:gap-5">
          <img src={logo} alt="Masurkar Law Associates logo" className="h-[280px] w-auto max-w-full object-contain sm:h-[336px] lg:h-[392px] xl:h-[448px]" />
          <p className="font-serif leading-snug text-header-foreground text-center">
            <span className="block text-[44px] font-semibold leading-none sm:text-[50px] lg:text-[56px]">MASURKAR</span>
            <span className="mt-1 block text-xl sm:text-2xl lg:text-3xl">LAW ASSOCIATES</span>
          </p>
        </div>
      </div>
    </aside>
  );
}

export function CompactFirmBrand() {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <img src={logo} alt="" className="size-10 shrink-0 object-contain" />
      <span className="min-w-0 font-serif text-sm leading-tight sm:text-base">
        <span className="block font-semibold">MASURKAR</span>
        <span className="block text-[10px] tracking-[0.12em] sm:text-xs">LAW ASSOCIATES</span>
      </span>
    </span>
  );
}
