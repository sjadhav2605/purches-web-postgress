/**
 * LocalStorage keys used throughout DDPL Procurement Portal
 */

export const STORAGE_KEYS = Object.freeze({
  TOKEN: 'ddpl_token',
  USER: 'ddpl_user',
  ACTIVE_ROLE: 'ddpl_active_role'
});

export const AUTH_STORAGE_KEYS = Object.freeze([
  STORAGE_KEYS.TOKEN,
  STORAGE_KEYS.USER,
  STORAGE_KEYS.ACTIVE_ROLE
]);
