
// Authentication is now handled locally via Email -> IndexedDB mapping.
// This file is kept as a stub to prevent build errors.

export const signInWithGoogle = async () => {
  console.warn("Firebase is disabled. Use local auth.");
  return null;
};

export const logout = async () => {
    // No-op
};

export const subscribeToAuth = (callback: (user: any) => void) => {
  // Immediately callback with null to indicate no cloud session, allowing App.tsx to handle local state.
  callback(null);
  return () => {};
};
