/** A completed probe's explicit auth reason is the only settings-page recovery signal. */
export function probeNeedsAuth(
  result: { passed: boolean; reason: string } | undefined,
  pending: boolean,
  error: unknown,
) {
  return (
    !pending && !error && result?.passed === false && result.reason === "auth"
  );
}
