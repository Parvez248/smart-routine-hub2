// Non-class blocks on the weekly routine — not a Session, never scheduled,
// never counted, never checked for conflicts. Mirrors the `specialBlocks`
// array in prisma/routine-data-july.json (Phase G of the import script
// deliberately never turns these into Session rows). Kept as data here, not
// an `if (day === "Wed")` in the grid, so a future block just means adding a
// row to this array (Step 46).
export type SpecialBlock = { day: string; label: string; appliesTo: string };

export const SPECIAL_BLOCKS: SpecialBlock[] = [
  { day: "Wed", label: "Club Activities", appliesTo: "all batches" },
];
