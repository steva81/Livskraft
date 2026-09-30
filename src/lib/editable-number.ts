// Keep an empty editor empty and invalid until the user supplies a number.
// Existing integer/range validation still runs on confirmation and save.
export function editableNumber(raw:string):number {
  return raw.trim() === "" ? Number.NaN : Number(raw)
}
