import { ethers } from 'ethers';

const POLYGON_RPC = 'https://polygon-rpc.com';
const SCAN_BASE   = 'https://polygonscan.com/tx';

export function polygonScanUrl(txHash: string) {
  return `${SCAN_BASE}/${txHash}`;
}

/**
 * Stores a 32-byte document hash on Polygon as immutable evidence.
 * Sends a self-transaction with the hash as calldata — no contract deployment needed.
 * Cost: ~$0.001 per notarization.
 */
export async function notarizeOnPolygon(documentHash: string): Promise<{ txHash: string; scanUrl: string }> {
  const key = process.env.POLYGON_PRIVATE_KEY;
  if (!key) throw new Error('POLYGON_PRIVATE_KEY no configurada en variables de entorno');

  const provider = new ethers.JsonRpcProvider(POLYGON_RPC);
  const wallet   = new ethers.Wallet(key, provider);

  // Pad hash to 32 bytes if needed, prepend 0x
  const data = documentHash.startsWith('0x') ? documentHash : `0x${documentHash}`;

  const tx = await wallet.sendTransaction({
    to:       wallet.address,
    value:    BigInt(0),
    data,
    gasLimit: BigInt(30_000),
  });

  await tx.wait(1);

  return { txHash: tx.hash, scanUrl: `${SCAN_BASE}/${tx.hash}` };
}
