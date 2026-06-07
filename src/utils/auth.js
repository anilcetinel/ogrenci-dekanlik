export const AUTH_SESSION_KEY = "sau_dekanlik_auth";
export const AUTH_ROLE_KEY = "sau_dekanlik_role";

export const AUTH_ROLES = {
  ADMIN: "admin",
  VIEWER: "viewer",
};

export function getAccessPins() {
  const legacyPin = import.meta.env.VITE_APP_PIN || (import.meta.env.DEV ? "sau2026" : "");

  return {
    adminPin: import.meta.env.VITE_ADMIN_PIN || legacyPin,
    viewerPin: import.meta.env.VITE_VIEWER_PIN || "",
  };
}

export function getCurrentRole() {
  if (typeof window === "undefined") return AUTH_ROLES.VIEWER;
  return sessionStorage.getItem(AUTH_ROLE_KEY) || AUTH_ROLES.VIEWER;
}

export function canEditData() {
  return getCurrentRole() === AUTH_ROLES.ADMIN;
}

export function setAuthenticatedRole(role) {
  sessionStorage.setItem(AUTH_SESSION_KEY, "ok");
  sessionStorage.setItem(AUTH_ROLE_KEY, role);
}

export function clearAuthSession() {
  sessionStorage.removeItem(AUTH_SESSION_KEY);
  sessionStorage.removeItem(AUTH_ROLE_KEY);
}
