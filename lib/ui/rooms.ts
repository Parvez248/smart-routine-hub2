// How a room is named in a sentence. Most rooms are bare numbers ("101"),
// which read as a room only with the word in front; the exam hall is named
// outright ("Hall Room"), where "Room Hall Room" would be wrong. Shared by
// the exam conflict messages and the exam UI so both say the same thing.
export function roomLabel(name: string): string {
  return /^\d+$/.test(name.trim()) ? `Room ${name}` : name;
}
