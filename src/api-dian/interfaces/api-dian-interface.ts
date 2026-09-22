export interface FacturaDianResponse {
  cufe: string;
  cude?: string;
  xmlUrl: string;
  pdfUrl: string;
  qrCode: string;
  qrImageBase64: string;
  publicUrl?: string;
  numeroCompleto: string;
  estado: 'aceptada' | 'rechazada';
  mensaje?: string;
  respuestaCompleta: any;
  warnings?: string[];
  errors?: any;
  /** Snapshot del rango DIAN usado (se persiste en el documento). */
  numberingRangeId?: number | null;
  resolutionNumber?: string | null;
  rangePrefix?: string | null;
}

export interface FacturaDianPdfResponse {
  status: string;
  message: string;
  data: {
    file_name: string;
    pdf_base_64_encoded: string;
  }

}

export interface filtroMunicipios {
  departamento?: string;
  nombre?: string;
}

export interface FactusTokenResponse {
  token_type: string;
  expires_in: number;
  access_token: string;
  refresh_token: string;
}

export interface FactusV2PaymentDetail {
  payment_form: string;
  payment_method_code: string;
  reference_code?: string;
  amount: string;
  due_date?: string;
}

export interface FactusV2PrepaymentDetail {
  reference_code: string;
  received_date: string;
  amount: string;
  note?: string;
}

export interface FactusV2Tax {
  code: string;
  rate: string;
  is_excluded?: boolean;
}

export interface FactusV2WithholdingTax {
  code: string;
  rate: string;
}

export interface FactusV2Customer {
  identification_document_code: string;
  identification: string;
  dv?: string | null;
  legal_organization_code: string;
  tribute_code?: string;
  responsibilities?: string[];
  company?: string;
  trade_name?: string;
  names?: string;
  address?: string;
  email?: string;
  phone?: string;
  country_code?: string;
  municipality_code?: string;
}

export interface FactusV2Item {
  code_reference: string;
  name: string;
  quantity: string;
  discount_rate?: string;
  discount_amount?: string;
  price: string;
  unit_measure_code: string;
  standard_code: string;
  note?: string;
  taxes: FactusV2Tax[];
  withholding_taxes?: FactusV2WithholdingTax[];
}

export interface FactusV2Establishment {
  name: string;
  address: string;
  phone_number: string;
  email: string;
  municipality_code: string;
}

export interface FactusV2BillPayload {
  reference_code: string;
  document?: string;
  numbering_range_id?: number | string;
  operation_type?: string;
  send_email?: boolean;
  observation?: string;
  created_time?: string;
  cash_rounding_amount?: string;
  payment_details: FactusV2PaymentDetail[];
  prepayment_details?: FactusV2PrepaymentDetail[];
  establishment?: FactusV2Establishment;
  customer: FactusV2Customer;
  items: FactusV2Item[];
  allowance_charges?: AllowanceChargesFactus[];
}

export interface FactusV2DocumentResponse<T = Record<string, unknown>> {
  status: string;
  message: string;
  data: T;
}

export interface FactusV2NotaAjustePayload {
  reference_code: string;
  correction_concept_code: string;
  customization_id?: string;
  bill_number?: string;
  numbering_range_id?: number | string;
  observation?: string;
  cash_rounding_amount?: string;
  payment_details: FactusV2PaymentDetail[];
  establishment?: FactusV2Establishment;
  customer: FactusV2Customer;
  items: FactusV2Item[];
  allowance_charges?: AllowanceChargesFactus[];
}

export interface AllowanceChargesFactus {
  concept_type: string,
  is_surcharge: boolean,
  reason: string,
  base_amount: string,
  amount: string
}

export interface FactusV2PayrollSettlement {
  month: number;
  year: number;
  payroll_period_code: string;
  pay_period_half?: string;
}

export interface FactusV2PayrollPayment {
  payment_method_code: string;
  bank_name?: string;
  account_type?: string;
  account_number?: string;
  payment_date: string;
}

export interface FactusV2PayrollWorker {
  identification_document_code: string;
  identification_number: string;
  first_name: string;
  other_names?: string;
  first_surname: string;
  second_surname: string;
  address: string;
  country_code: string;
  municipality_code?: string;
  has_integral_salary: boolean;
  has_high_risk: boolean;
  worker_type_code: string;
  worker_subtype: string;
  contract_type: string;
  employee_code?: string;
  salary: string;
  entry_date: string;
  days_worked: string;
  retirement_date?: string;
}

export interface FactusV2PayrollPayload {
  reference_code: string;
  observation?: string;
  numbering_range_id?: number | string;
  settlement_period: FactusV2PayrollSettlement;
  payment: FactusV2PayrollPayment;
  worker: FactusV2PayrollWorker;
  accruals: Record<string, unknown>;
  deductions: Record<string, unknown>;
}

export interface FactusPayrollResult {
  estado: 'aceptada' | 'rechazada';
  referenceCode: string;
  cune: string;
  numero: string;
  mensaje: string;
  respuestaCompleta: any;
  warnings: string[];
  errors: any;
  numberingRangeId: number | null;
  resolutionNumber: string | null;
  rangePrefix: string | null;
}

