declare const enterpriseIdBrand: unique symbol;

/** A tenant identifier that has been resolved as an enterprise context. */
export type EnterpriseId = string & {
  readonly [enterpriseIdBrand]: 'EnterpriseId';
};

export interface EnterpriseContextRef {
  enterpriseId: EnterpriseId;
  membershipId: string;
  userId: string;
}
