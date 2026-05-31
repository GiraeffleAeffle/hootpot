const ATTO_PER_CRC = BigInt("1000000000000000000");

export function crcToAtto(amount: string): bigint {
  const [whole, fractional = ""] = amount.split(".");
  const wholeAtto = BigInt(whole) * ATTO_PER_CRC;
  const fractionalAtto = BigInt(fractional.padEnd(18, "0").slice(0, 18) || "0");
  return wholeAtto + fractionalAtto;
}

export function attoToCrcNumber(amount: bigint): number {
  const whole = amount / ATTO_PER_CRC;
  const fractional = amount % ATTO_PER_CRC;
  const paddedFraction = fractional.toString().padStart(18, "0").slice(0, 4);
  return Number(`${whole}.${paddedFraction}`);
}

export function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (normalized.length % 2 !== 0 || /[^a-fA-F0-9]/.test(normalized)) {
    throw new Error("Invalid hex string.");
  }
  const bytes = new Uint8Array(normalized.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

export function normalizeTxHash(value: string): `0x${string}` | null {
  const trimmed = value.trim();
  if (!/^0x[a-fA-F0-9]{64}$/.test(trimmed)) return null;
  return trimmed as `0x${string}`;
}
