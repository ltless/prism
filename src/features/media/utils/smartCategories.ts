// Categories recognized by the Go dashboard endpoint (`smart=true&categories=...`).
// ponytail: hard-coded to match backend CLIP categories; extend when Go adds more.
export const SMART_CATEGORIES = [
  "people",
  "nature",
  "food",
  "animal",
  "building",
  "vehicle",
  "document",
  "indoor",
  "outdoor",
] as const;
