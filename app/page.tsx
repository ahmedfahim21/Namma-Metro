import { TripPlanner } from "@/components/TripPlanner";

export default function HomePage() {
  return (
    <div>
      <div className="border-b border-border bg-surface">
        <div className="mx-auto max-w-2xl px-4 pt-8 pb-2">
          <h1 className="text-2xl font-bold">Plan your Namma Metro trip</h1>
          <p className="mt-1 text-sm text-muted">
            Purple, Green &amp; Yellow lines. Works offline once loaded — real fares, next-train
            estimates and interchange guidance.
          </p>
        </div>
      </div>
      <TripPlanner />
    </div>
  );
}
