import { InternalRole } from "@prisma/client";


export const CUSTOMER = InternalRole.CUSTOMER;
export const SELLER = InternalRole.SELLER;
export const SUPER_ADMIN = InternalRole.SUPER_ADMIN;
export type { InternalRole };

export const roleLabels = {
  [CUSTOMER]: "Kunde",
  [SELLER]: "Verkäufer",
  [SUPER_ADMIN]: "Super Admin",
} satisfies Record<InternalRole, string>;

export function hasRole(role: string, required: InternalRole): boolean {
  if (role === SUPER_ADMIN) return true;
  if (required === CUSTOMER) return role === CUSTOMER || role === SELLER;
  return role === required;
}
