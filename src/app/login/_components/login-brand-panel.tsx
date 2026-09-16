/**
 * Dark "ledger spine" brand panel for the login page — shows the Kirana
 * Store wordmark over a ruled-paper motif. Purely decorative; renders
 * beside (desktop) or above (mobile) `LoginForm`.
 */
export const LoginBrandPanel = () => {
  return (
    <div
      className="relative flex h-40 w-full shrink-0 flex-col justify-end overflow-hidden bg-sidebar p-8 md:h-auto md:w-[42%] md:justify-center md:p-12"
      style={{
        backgroundImage:
          "repeating-linear-gradient(to bottom, transparent, transparent 27px, var(--sidebar-border) 28px)",
      }}
    >
      <div className="mb-3 h-0.5 w-10 bg-primary" />
      <h1 className="font-heading text-3xl font-semibold tracking-tight text-sidebar-foreground md:text-4xl">
        Kirana Store
      </h1>
      <p className="mt-2 max-w-xs text-sm text-sidebar-foreground/70">
        Billing and inventory for your shop, kept like a ledger.
      </p>
    </div>
  );
};
