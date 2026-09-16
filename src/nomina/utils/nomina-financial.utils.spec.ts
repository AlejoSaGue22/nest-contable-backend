import {
  limitVariableDeductions,
  netFinancialEntries,
} from './nomina-financial.utils';

describe('Nomina financial rules', () => {
  it('limits variable deductions and mutates the persisted detail values', () => {
    const details = [
      { conceptoId: 'a', tipo: 'DEDUCCION', valor: 400 },
      { conceptoId: 'b', tipo: 'DEDUCCION', valor: 300 },
    ];

    const total = limitVariableDeductions(details, 500);

    expect(details.map((detail) => detail.valor)).toEqual([400, 100]);
    expect(total).toBe(500);
  });

  it('does not allow a negative deduction limit', () => {
    const details = [{ conceptoId: 'a', tipo: 'DEDUCCION', valor: 100 }];

    const total = limitVariableDeductions(details, -1);

    expect(details[0].valor).toBe(0);
    expect(total).toBe(0);
  });

  it('leaves one side only after netting an analytical entry', () => {
    const result = netFinancialEntries([
      { debito: 100.25, credito: 40.1 },
      { debito: 50, credito: 50 },
    ]);

    expect(result).toEqual([{ debito: 60.15, credito: 0 }]);
  });
});
