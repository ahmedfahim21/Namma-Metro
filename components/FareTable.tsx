import type { FareResult } from "@/packages/fares/src/index";
import { formatCurrency } from "@/lib/format";

export function FareTable({ fare }: { fare: FareResult }) {
  const context = fare.isFullDiscountDay
    ? "Sunday / national holiday — off-peak rates all day"
    : fare.isPeak
      ? "Peak hours — Smart Card discount is reduced"
      : "Off-peak hours — best Smart Card discount";

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="eyebrow">Fare</h3>
        <span className="text-[0.8125rem] text-ink-muted">{context}</span>
      </div>

      <table className="mt-2 w-full border-collapse text-sm">
        <tbody>
          {fare.quotes.map((q) => {
            // Modes often tie (a 5% QR discount and a 5% peak Smart Card
            // discount land on the same rupee). Mark every mode that hits the
            // best price rather than arbitrarily crowning the first one.
            const best = q.fare === fare.cheapest.fare;
            return (
              <tr key={q.mode} className="border-b border-hairline last:border-0">
                <td className="py-2 pr-2">
                  <span className={best ? "font-semibold text-ink" : "text-ink-secondary"}>
                    {q.label}
                  </span>
                  {best && (
                    <span className="ml-2 align-middle rounded-full bg-sunken px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wider text-ink-secondary">
                      Cheapest
                    </span>
                  )}
                </td>
                <td className="tnum py-2 pr-3 text-right text-[0.8125rem] text-ink-faint">
                  {q.savingsVsToken > 0 ? `−${formatCurrency(q.savingsVsToken)}` : ""}
                </td>
                <td
                  className={`tnum w-14 py-2 text-right tabular-nums ${
                    best ? "text-[1.0625rem] font-semibold text-ink" : "text-ink-secondary"
                  }`}
                >
                  {formatCurrency(q.fare)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {fare.passes.length > 0 && (
        <p className="mt-2.5 text-[0.8125rem] leading-relaxed text-ink-muted">
          {fare.passes.map((p, i) => (
            <span key={p.id}>
              {i > 0 && <span className="text-ink-faint"> · </span>}
              {p.label} ({formatCurrency(p.price)}) pays off after{" "}
              <span className="tnum">{p.breakEvenTrips}</span> trips like this
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
