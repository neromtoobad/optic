// PROOF STEP 1 (run this yourself): move Polygon funds from the old proof wallet
// into the OKX agentic wallet's EOA, so the polymarket-plugin can trade.
//
//   node scripts/fund-plugin-wallet.mjs
//
// Legs are INDEPENDENT and re-runnable: each leg is skipped when already done.
// Sends from TICKET_PROOF_PK (.env):  all USDC.e  +  0.5 POL (gas for approve txs)
// To the agentic wallet EOA on Polygon: 0xda30617e4d23810eb948724a4dce0452dfda7e9d
import "dotenv/config";
import { createWalletClient, createPublicClient, http, encodeFunctionData, parseEther, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon } from "viem/chains";

const USDCE = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
const DEST = "0xda30617e4d23810eb948724a4dce0452dfda7e9d"; // OKX agentic wallet EOA (verified via onchainos)
const POL_TO_SEND = parseEther("0.5");
const RPCS = [process.env.POLYGON_RPC, "https://polygon.drpc.org", "https://polygon-bor-rpc.publicnode.com", "https://1rpc.io/matic"].filter(Boolean);

const erc20 = [
  { name: "transfer", type: "function", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "v", type: "uint256" }], outputs: [{ type: "bool" }] },
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
];

let rpc;
let pub;
for (const r of RPCS) {
  try {
    pub = createPublicClient({ chain: polygon, transport: http(r) });
    await pub.getBlockNumber();
    rpc = r;
    break;
  } catch { pub = null; }
}
if (!pub) { console.error("no Polygon RPC reachable — try again in a minute"); process.exit(1); }
console.log("rpc:", rpc);

const account = privateKeyToAccount(process.env.TICKET_PROOF_PK);
const wallet = createWalletClient({ account, chain: polygon, transport: http(rpc) });
console.log("from (old proof wallet):", account.address);
console.log("to   (agentic wallet):  ", DEST);

// tolerant receipt wait: RPC lag on a fresh block must not crash the run
async function waitTolerant(hash) {
  for (let i = 0; i < 20; i++) {
    const r = await pub.getTransactionReceipt({ hash }).catch(() => null);
    if (r) return r.status;
    await new Promise((res) => setTimeout(res, 4000));
  }
  return "unconfirmed (check the hash on polygonscan)";
}

// ── leg 1: USDC.e ───────────────────────────────────────────────────────────
const usdce = await pub.readContract({ address: USDCE, abi: erc20, functionName: "balanceOf", args: [account.address] });
if (usdce > 0n) {
  const h = await wallet.sendTransaction({ to: USDCE, data: encodeFunctionData({ abi: erc20, functionName: "transfer", args: [DEST, usdce] }) });
  console.log(`USDC.e leg: sending ${Number(usdce) / 1e6} — tx ${h} → ${await waitTolerant(h)}`);
} else {
  console.log("USDC.e leg: already moved — skipping");
}

// ── leg 2: POL for gas ──────────────────────────────────────────────────────
const destPol = await pub.getBalance({ address: DEST });
const srcPol = await pub.getBalance({ address: account.address });
if (destPol >= POL_TO_SEND / 2n) {
  console.log(`POL leg: destination already has ${formatEther(destPol)} POL — skipping`);
} else if (srcPol > POL_TO_SEND) {
  const h = await wallet.sendTransaction({ to: DEST, value: POL_TO_SEND });
  console.log(`POL leg: sending 0.5 — tx ${h} → ${await waitTolerant(h)}`);
} else {
  console.log(`POL leg: source only has ${formatEther(srcPol)} POL — skipped (gasless plugin modes still work)`);
}

const finalUsd = await pub.readContract({ address: USDCE, abi: erc20, functionName: "balanceOf", args: [DEST] });
const finalPol = await pub.getBalance({ address: DEST });
console.log(`\nDONE. Agentic wallet holds ${Number(finalUsd) / 1e6} USDC.e + ${formatEther(finalPol)} POL on Polygon.`);
console.log('Next: npm run ticket -- "btc next 5 min" yes 4   → then run the command it prints.');
