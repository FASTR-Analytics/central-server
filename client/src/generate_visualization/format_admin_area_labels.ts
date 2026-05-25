export function getNigeriaAdminAreaLabelReplacements(
  jsonArray: any[],
): Record<string, string> {
  const replacements: Record<string, string> = {};

  const uniqueValues = new Set<string>();
  for (const item of jsonArray) {
    if (item.admin_area_3) {
      uniqueValues.add(item.admin_area_3);
    }
    if (item.admin_area_4) {
      uniqueValues.add(item.admin_area_4);
    }
  }

  for (const value of uniqueValues) {
    const formatted = formatNigeriaAdminAreaLabel(value);
    if (formatted !== value) {
      replacements[value] = formatted;
    }
  }

  return replacements;
}

function formatNigeriaAdminAreaLabel(label: string): string {
  // Split by space and trim each word
  let words = label
    .split(" ")
    .map((word) => word.trim())
    .filter((word) => word.length > 0);

  // If first word is exactly 2 characters (e.g., "ab"), remove it
  if (words.length > 0 && words[0].length === 2) {
    words = words.slice(1);
  }

  // Remove "State" and "Local Government Area" (case-insensitive)
  words = words.filter((word) => word.toLowerCase() !== "state");

  return words
    .join(" ")
    .replace(/local government area/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}
