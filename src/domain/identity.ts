export function createId(): string {
  return crypto.randomUUID()
}

export function createTimestamp(date: Date = new Date()): string {
  return date.toISOString()
}
