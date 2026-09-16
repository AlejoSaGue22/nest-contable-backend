export interface DeduccionSnapshotValue {
  conceptoId?: string;
  tipo?: string;
  valor?: number;
}

export interface FinancialEntryValue {
  debito: number;
  credito: number;
}

export function limitVariableDeductions<T extends DeduccionSnapshotValue>(
  details: T[],
  maximum: number,
): number {
  let remaining = Math.max(0, roundMoney(maximum));

  for (const detail of details.filter((item) => Boolean(item.conceptoId))) {
    const allowed = Math.min(Math.max(0, Number(detail.valor || 0)), remaining);
    detail.valor = roundMoney(allowed);
    remaining = roundMoney(remaining - allowed);
  }

  return roundMoney(
    details
      .filter((item) => Boolean(item.conceptoId))
      .reduce((total, item) => total + Number(item.valor || 0), 0),
  );
}

export function netFinancialEntries<T extends FinancialEntryValue>(entries: T[]): T[] {
  return entries
    .map((entry) => {
      const debit = Number(entry.debito || 0);
      const credit = Number(entry.credito || 0);
      const difference = roundMoney(debit - credit);
      return {
        ...entry,
        debito: difference > 0 ? difference : 0,
        credito: difference < 0 ? Math.abs(difference) : 0,
      };
    })
    .filter((entry) => entry.debito > 0 || entry.credito > 0);
}

export function roundMoney(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
