export const USER = "USER";
export const SUPER_ADMIN = "SUPER_ADMIN";

export type InternalRole = typeof USER | typeof SUPER_ADMIN;

export const roleLabels = {
  [USER]: "User",
  [SUPER_ADMIN]: "Super-Admin",
} as const satisfies Record<InternalRole, string>;

const allowedRoles: Record<InternalRole, readonly InternalRole[]> = {
  [USER]: [
    USER,
    SUPER_ADMIN,
  ],
  [SUPER_ADMIN]: [SUPER_ADMIN],
};

export function hasRole(role: string, required: InternalRole): boolean {
  return allowedRoles[required]?.some(allowedRole => allowedRole === role) ?? false;
}
