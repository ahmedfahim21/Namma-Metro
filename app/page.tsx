import { TripPlanner } from "@/components/TripPlanner";

export default function HomePage() {
  return (
    <div>
      <div className="mx-auto w-full max-w-[110rem] px-4 pt-6 pb-1 sm:px-6">
        <h1 className="text-xl tracking-tight">Plan your Namma Metro trip</h1>
        <p className="mt-0.5 text-sm text-muted">
          Purple, Green &amp; Yellow lines — real fares, next-train estimates and interchange
          guidance. Works offline once loaded.
        </p>
      </div>
      <TripPlanner />
    </div>
  );
}
