export type EnterpriseAccessErrorCode =
  | 'IDENTITY_REQUIRED'
  | 'ENTERPRISE_MEMBERSHIP_REQUIRED'
  | 'ENTERPRISE_SELECTION_REQUIRED'
  | 'ENTERPRISE_ACCESS_FORBIDDEN'
  | 'ENTERPRISE_PERMISSION_DENIED'
  | 'ENTERPRISE_CONTEXT_UNAVAILABLE';

export class EnterpriseAccessError extends Error {
  constructor(
    public readonly code: EnterpriseAccessErrorCode,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'EnterpriseAccessError';
  }
}

export function isEnterpriseAccessError(error: unknown): error is EnterpriseAccessError {
  return error instanceof EnterpriseAccessError;
}
