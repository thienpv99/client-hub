// Google sign-in (SSO) for New Era staff — README §3 "Cấu hình Google SSO".
// The OAuth client ID is PUBLIC (it is sent to every browser that shows the Google button); it is not a secret.
// Leave it empty to hide Google sign-in entirely (the email + password form stays).
import type { Role } from '@/domain/types';

export type InternalRole = Extract<Role, 'director' | 'am' | 'member'>;

/** OAuth 2.0 client ID (type "Web application") from Google Cloud Console, e.g. '1234-abc.apps.googleusercontent.com'. */
export const GOOGLE_CLIENT_ID: string = '569131238516-4rshaotjr8cua4l5sqacs579buq0hamg.apps.googleusercontent.com';

/**
 * The "Authorized JavaScript origins" of that client (keep both lists the same). On any other origin — a Cloudflare
 * preview URL (*.pages.dev), 127.0.0.1, file://, a previewer's about:srcdoc — Google refuses the button, so it is hidden.
 */
export const GOOGLE_JS_ORIGINS: readonly string[] = ['https://clienthub.nea.io.vn', 'http://localhost:8780'];

/** Only Google accounts of this Workspace domain may sign in (hd claim AND email domain). */
export const SSO_ALLOWED_DOMAIN = 'newera.inc';

/**
 * Role of a staff member created by their first Google sign-in. The client chose 'director' (full access) for every
 * New Era account because the data is a sample model; set 'member' to make the director promote people in Cài đặt.
 */
export const SSO_DEFAULT_ROLE: InternalRole = 'director';

/** Emails (lower case) that get role director when they are created by their first Google sign-in. */
export const SSO_ADMIN_EMAILS: string[] = [];
