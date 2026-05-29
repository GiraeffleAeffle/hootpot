const CRC_V2_TRANSFER_DATA_VERSION = 1;
const HOOTPOT_TRANSFER_DATA_TYPE = 0x0001;
const MAX_TRANSFER_DATA_PAYLOAD_BYTES = 0xffff;

export function encodeHootpotTransferData(payload: string): string {
  const trimmed = payload.trim();
  if (!trimmed) {
    throw new Error("Transfer data payload must not be empty.");
  }

  const payloadBytes = new TextEncoder().encode(trimmed);
  if (payloadBytes.length > MAX_TRANSFER_DATA_PAYLOAD_BYTES) {
    throw new Error("Transfer data payload is too large.");
  }

  const bytes = new Uint8Array(5 + payloadBytes.length);
  bytes[0] = CRC_V2_TRANSFER_DATA_VERSION;
  bytes[1] = (HOOTPOT_TRANSFER_DATA_TYPE >> 8) & 0xff;
  bytes[2] = HOOTPOT_TRANSFER_DATA_TYPE & 0xff;
  bytes[3] = (payloadBytes.length >> 8) & 0xff;
  bytes[4] = payloadBytes.length & 0xff;
  bytes.set(payloadBytes, 5);

  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function buildGnosisCrcTransferUrl(
  recipient: string,
  amount: string,
  data: string,
): string {
  const url = new URL(`https://app.gnosis.io/transfer/${recipient}/crc`);
  url.searchParams.set("amount", amount);
  url.searchParams.set("data", data);
  return url.toString();
}

