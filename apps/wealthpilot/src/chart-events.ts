export interface CashMovement {
  id: string;
  label: string;
  account: string;
  amount: number;
  kind: "income" | "expense" | "transfer" | "adjustment" | "provision";
  estimated?: boolean;
}
export interface EventPoint {
  date: string;
  value: number;
  future: boolean;
  movements?: CashMovement[];
  events?: string[];
}
/** All daily detail is retained. Only visual marker prominence uses this threshold. */
export function notableDays(points: EventPoint[]) {
  const magnitudes = points
    .flatMap((p) =>
      (p.movements ?? [])
        .filter((m) => m.kind !== "transfer")
        .map((m) => Math.abs(m.amount)),
    )
    .sort((a, b) => a - b);
  const threshold = Math.max(
    5000,
    Math.min(20000, (magnitudes[Math.floor(magnitudes.length / 2)] ?? 0) * 2),
  );
  const historical = points.filter((p) => !p.future);
  const high = historical.reduce<EventPoint | undefined>(
    (a, p) => (!a || p.value > a.value ? p : a),
    undefined,
  );
  const low = historical.reduce<EventPoint | undefined>(
    (a, p) => (!a || p.value < a.value ? p : a),
    undefined,
  );
  const futureLow = points
    .filter((p) => p.future)
    .reduce<
      EventPoint | undefined
    >((a, p) => (!a || p.value < a.value ? p : a), undefined);
  return points.flatMap((p, index) => {
    const movements = p.movements ?? [];
    const gross = movements.reduce((n, m) => n + Math.abs(m.amount), 0);
    const significant =
      movements.some(
        (m) => m.amount >= 5000 || Math.abs(m.amount) >= threshold,
      ) || gross >= threshold * 2;
    const extrema =
      p === high
        ? "Pic"
        : p === low
          ? "Creux"
          : p === futureLow
            ? "Bas prévu"
            : undefined;
    if (!significant && !extrema && !(!movements.length && p.events?.length))
      return [];
    return [
      {
        point: p,
        index,
        extrema,
        significant,
        change: movements.reduce((n, m) => n + m.amount, 0),
        largest: [...movements].sort(
          (a, b) => Math.abs(b.amount) - Math.abs(a.amount),
        )[0],
      },
    ];
  });
}
