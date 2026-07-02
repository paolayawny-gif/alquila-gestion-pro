export const APP_ID = "alquilagestion-pro" as const;
export const SUPER_ADMIN_EMAIL = "paolayawny@gmail.com" as const;
if (!process.env.SUPERADMIN_UID) {
  throw new Error("SUPERADMIN_UID env var must be set");
}
export const SUPERADMIN_UID = process.env.SUPERADMIN_UID;
