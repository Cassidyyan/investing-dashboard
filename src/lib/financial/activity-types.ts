// Observed broker-native aliases. Preserve unknown codes rather than guessing.
export function activityType(raw: string): string {
  return (
    (
      {
        OPTIONS_SHORT_EXPIRY: "OPTIONEXPIRATION",
        OPTIONEXPIRY: "OPTIONEXPIRATION",
        OPTIONS_ASSIGN: "OPTIONASSIGNMENT",
        OPTIONASSIGN: "OPTIONASSIGNMENT",
      } as Record<string, string>
    )[raw] || raw
  );
}
