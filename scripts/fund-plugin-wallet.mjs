// PROOF STEP 1 (run this yourself): move the stranded Polygon funds from the old
// proof wallet into the OKX agentic wallet's EOA, so the polymarket-plugin can trade.
//
//   node scripts/fund-plugin-wallet.mjs
//
// Sends from TICKET_PROOF_PK (.env):  all USDC.e  +  0.5 POL (gas for the approve tx)
// To the agentic wallet EOA on Polygon: 0xda30617e4d23810eb948724a4dce0452dfda7e9d
import "dotenv/config";
import { createWalletClient, createPublicClient, http, encodeFunctionData, parseEther, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon } from "viem/chains";

const RPC = process.env.POLYGON_RPC ?? "https://polygon.drpc.org";
const USDCE = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
const DEST = "0xda30617e4d23810eb948724a4dce0452dfda7e9d"; // OKX agentic wallet EOA (verified via onchainos)
const POL_TO_SEND = parseEther("0.5");

const erc20 = [
  { name: "transfer", type: "function", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "v", type: "uint256" }], outputs: [{ type: "bool" }] },
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
];

const account = privateKeyToAccount(process.env.TICKET_PROOF_PK);
const wallet = createWalletClient({ account, chain: polygon, transport: http(RPC) });
const pub = createPublicClient({ chain: polygon, transport: http(RPC) });

console.log("from (old proof wallet):", account.address);
console.log("to   (agentic wallet):  ", DEST);

const usdce = await pub.readContract({ address: USDCE, abi: erc20, functionName: "balanceOf", args: [account.address] });
const pol = await pub.getBalance({ address: account.address });
console.log(`holdings: ${Number(usdce) / 1e6} USDC.e · ${formatEther(pol)} POL`);
if (usdce === 0n) { console.log("no USDC.e to move — nothing to do"); process.exit(0); }

const h1 = await wallet.sendTransaction({ to: USDCE, data: encodeFunctionData({ abi: erc20, functionName: "transfer", args: [DEST, usdce] }) });
console.log("USDC.e transfer tx:", h1);
await pub.waitForTransactionReceipt({ hash: h1 });

if (pol > POL_TO_SEND) {
  const h2 = await wallet.sendTransaction({ to: DEST, value: POL_TO_SEND });
  console.log("POL transfer tx:   ", h2);
  await pub.waitForTransactionReceipt({ hash: h2 });
} else {
  console.log("POL balance too low to forward 0.5 — skipped (plugin gasless modes still work)");
}

const after = await pub.readContract({ address: USDCE, abi: erc20, functionName: "balanceOf", args: [DEST] });
console.log(`\nDONE. Agentic wallet now holds ${Number(after) / 1e6} USDC.e on Polygon.`);
console.log("Next: npm run ticket -- \"btc next 5 min\" yes 4   → then run the command it prints.");
