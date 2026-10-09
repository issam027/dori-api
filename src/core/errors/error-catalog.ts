/**
 * All API error codes, mapped to HTTP status and translationKey.
 * § 6.9 of the spec.
 */
export const ERROR_CATALOG: Record<
  string,
  { status: number; translationKey: string }
> = {
  VALIDATION_ERROR: {
    status: 400,
    translationKey: 'errors.validation_error',
  },
  UNAUTHENTICATED: {
    status: 401,
    translationKey: 'errors.unauthenticated',
  },
  FORBIDDEN_PERMISSION: {
    status: 403,
    translationKey: 'errors.forbidden_permission',
  },
  FORBIDDEN_ROLE_ESCALATION: {
    status: 403,
    translationKey: 'errors.forbidden_role_escalation',
  },
  QUEUE_NOT_FOUND: {
    status: 404,
    translationKey: 'errors.queue_not_found',
  },
  SITE_NOT_FOUND: {
    status: 404,
    translationKey: 'errors.site_not_found',
  },
  REGISTRATION_NOT_FOUND: {
    status: 404,
    translationKey: 'errors.registration_not_found',
  },
  PERSON_NOT_FOUND: {
    status: 404,
    translationKey: 'errors.person_not_found',
  },
  USER_NOT_FOUND: {
    status: 404,
    translationKey: 'errors.user_not_found',
  },
  ROLE_NOT_FOUND: {
    status: 404,
    translationKey: 'errors.role_not_found',
  },
  PERMISSION_NOT_FOUND: {
    status: 404,
    translationKey: 'errors.permission_not_found',
  },
  TIER_NOT_FOUND: {
    status: 404,
    translationKey: 'errors.tier_not_found',
  },
  NOTIFICATION_NOT_FOUND: {
    status: 404,
    translationKey: 'errors.notification_not_found',
  },
  SESSION_NOT_FOUND: {
    status: 404,
    translationKey: 'errors.session_not_found',
  },
  NOTE_NOT_FOUND: {
    status: 404,
    translationKey: 'errors.note_not_found',
  },
  TRANSLATION_NOT_FOUND: {
    status: 404,
    translationKey: 'errors.translation_not_found',
  },
  THREAD_OCCUPIED: {
    status: 409,
    translationKey: 'errors.thread_occupied',
  },
  THREAD_UNAVAILABLE: {
    status: 409,
    translationKey: 'errors.thread_unavailable',
  },
  SESSION_ALREADY_OPEN: {
    status: 409,
    translationKey: 'errors.session_already_open',
  },
  TIER_NOT_OFFERED_BY_QUEUE: {
    status: 409,
    translationKey: 'errors.tier_not_offered',
  },
  TIER_IS_SYSTEM: {
    status: 409,
    translationKey: 'errors.tier_is_system',
  },
  DUPLICATE_ACTIVE_REGISTRATION: {
    status: 409,
    translationKey: 'errors.duplicate_active_registration',
  },
  APPOINTMENT_SLOT_FULL: {
    status: 409,
    translationKey: 'errors.appointment_slot_full',
  },
  APPOINTMENT_EXPIRED: {
    status: 409,
    translationKey: 'errors.appointment_expired',
  },
  REGISTRATION_NOT_IN_PROGRESS: {
    status: 409,
    translationKey: 'errors.registration_not_in_progress',
  },
  REGISTRATION_CLOSED: {
    status: 409,
    translationKey: 'errors.registration_closed',
  },
  ACCOUNT_LOCKED: {
    status: 409,
    translationKey: 'errors.account_locked',
  },
  QUEUE_EMPTY: {
    status: 200,
    translationKey: 'queue.next.empty',
  },
  APPOINTMENTS_DISABLED: {
    status: 422,
    translationKey: 'errors.appointments_disabled',
  },
  TRANSLATION_PARAM_MISMATCH: {
    status: 422,
    translationKey: 'errors.translation_param_mismatch',
  },
  TOKEN_EXPIRED: {
    status: 410,
    translationKey: 'public.token_expired',
  },
  RATE_LIMITED: {
    status: 429,
    translationKey: 'errors.rate_limited',
  },
  RESOURCE_NOT_FOUND: {
    status: 404,
    translationKey: 'errors.resource_not_found',
  },
  CONFLICT: {
    status: 409,
    translationKey: 'errors.conflict',
  },
  INTERNAL_ERROR: {
    status: 500,
    translationKey: 'errors.internal_error',
  },
};
