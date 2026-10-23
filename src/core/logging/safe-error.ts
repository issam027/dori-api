/**
 * Produces a low-cardinality error description suitable for production logs.
 * Error messages and stacks are deliberately excluded because they can contain
 * credentials, tokens, request payloads or personal data.
 */
export function safeErrorName(error: unknown): string {
  if (error instanceof Error && error.name) return error.name;
  return 'UnknownError';
}
