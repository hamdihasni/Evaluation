// Version "locale" (sans cloud) : remplacée automatiquement par la version Firebase
// lors de `npm run build:cloud` (voir cloud-src/).
export const available = false;
export const onUser = cb => { cb(null); return () => {}; };
export const login = async () => {}; export const register = async () => {};
export const logout = async () => {}; export const reset = async () => {};
export const pull = async () => null; export const push = async () => {};
