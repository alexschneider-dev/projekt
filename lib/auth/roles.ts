export const roleLabels = {
  user: "User",
  admin: "Admin",
  super_admin: "Super-Admin",
} as const;
export type InternalRole = keyof typeof roleLabels;
export function hasRole(role: string, required: InternalRole): boolean {
  const allowed: Record<InternalRole, readonly string[]> = {
    user: ["user", "admin", "super_admin"],
    admin: ["admin", "super_admin"],
    super_admin: ["super_admin"],
  };
  return allowed[required].includes(role);
}
