import { MaterialIcon } from "./MaterialIcon";

interface ComingSoonBannerProps {
  feature?: string;
}

export function ComingSoonBanner({ feature }: ComingSoonBannerProps) {
  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3.5">
      <MaterialIcon
        name="construction"
        className="mt-0.5 shrink-0 text-lg text-amber-400"
      />
      <div>
        <p className="text-sm font-medium text-amber-300">
          {feature ? `${feature} is coming soon` : "This feature is coming soon"}
        </p>
        <p className="mt-0.5 text-xs text-amber-400/70">
          We are actively building this. Full functionality will be available in an upcoming release.
        </p>
      </div>
    </div>
  );
}
