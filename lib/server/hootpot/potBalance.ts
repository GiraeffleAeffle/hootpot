import { isConfiguredAddress, POT_ADDRESS } from "@/lib/hootpot/config";

type ProfileView = {
  v1Balance?: string;
  v2Balance?: string;
};

export function normalizeCrcNumber(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Number(value.toFixed(2));
}

function parseCrcBalance(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Number(value.replace(",", "."));
  return normalizeCrcNumber(parsed);
}

export async function getConfiguredPotBalanceCrc(): Promise<number> {
  if (!isConfiguredAddress(POT_ADDRESS)) return 0;

  try {
    const { Sdk } = await import("@aboutcircles/sdk");
    const sdk = new Sdk();
    const view = (await sdk.rpc.profile.getProfileView(
      POT_ADDRESS as `0x${string}`,
    )) as ProfileView;

    return parseCrcBalance(view.v2Balance ?? view.v1Balance);
  } catch (error) {
    console.warn("[hootpot] could not load pot balance", error);
    return 0;
  }
}
