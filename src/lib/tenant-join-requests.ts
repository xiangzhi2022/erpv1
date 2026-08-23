export type EnterpriseJoinRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface EnterpriseJoinRequestRow {
  id: string;
  enterprise_id: string;
  user_id: string;
  status: EnterpriseJoinRequestStatus;
  requested_role_code: string | null;
  message: string | null;
  handled_by: string | null;
  handled_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ExistingEmployeeProfile {
  id: string;
  user_id?: string | null;
}

interface EmployeeProfileWriteInput {
  existingByUserId: ExistingEmployeeProfile | null;
  existingByPhone: ExistingEmployeeProfile | null;
  memberUserId: string;
  enterpriseId: string;
  phone: string;
  name: string;
  employeeNo: string;
}

export type EmployeeProfileWrite =
  | { action: 'none'; id: string }
  | { action: 'update'; id: string; values: Record<string, string | null> }
  | { action: 'insert'; values: Record<string, string | null> };

export function normalizePhone(value: unknown): string | null {
  const phone = typeof value === 'string' ? value.replace(/\D/g, '') : '';
  return /^1[3-9]\d{9}$/.test(phone) ? phone : null;
}

export function makeEmployeeNo(phone: string): string {
  const today = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  return `E${today}${phone.slice(-4)}`;
}

export function chooseEmployeeProfileWrite(input: EmployeeProfileWriteInput): EmployeeProfileWrite {
  if (input.existingByUserId?.id) return { action: 'none', id: input.existingByUserId.id };
  const values = {
    enterprise_id: input.enterpriseId,
    user_id: input.memberUserId,
    employee_no: input.employeeNo,
    name: input.name,
    phone: input.phone,
    status: 'active',
    updated_at: new Date().toISOString(),
  };
  if (input.existingByPhone?.id) return { action: 'update', id: input.existingByPhone.id, values };
  return { action: 'insert', values };
}
