import dotenv from 'dotenv';
dotenv.config();

import { Command } from 'commander';
import { Contract, JsonRpcProvider, formatUnits } from 'ethers';
import CometAbi from './abi/Comet.json';
import { loadEnv } from './config';

const UNISWAP_FACTORY = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';
const UNISWAP_INIT_CODE_HASH = '0x96e8ac4277198fff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845';
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

function sortTokens(a: string, b: string): [string, string] {
  return a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a];
}

function pairFor(tokenA: string, tokenB: string): string {
  const [t0, t1] = sortTokens(tokenA, tokenB);
  const packed = `0xff${UNISWAP_FACTORY.slice(2)}${t0.slice(2).padStart(40, '0')}${t1.slice(2).padStart(40, '0')}${UNISWAP_INIT_CODE_HASH.slice(2)}`;
  const addr = '0x' + Buffer.from(require('js-sha3').keccak_256.arrayBuffer(Buffer.from(packed, 'hex'))).subarray(12).toString('hex');
  return addr;
}

const PairAbi = [
  { constant: true, inputs: [], name: 'getReserves', outputs: [ { name: '_reserve0', type: 'uint112' }, { name: '_reserve1', type: 'uint112' }, { name: '_blockTimestampLast', type: 'uint32' } ], payable: false, stateMutability: 'view', type: 'function' },
  { constant: true, inputs: [], name: 'token0', outputs: [ { name: '', type: 'address' } ], payable: false, stateMutability: 'view', type: 'function' },
  { constant: true, inputs: [], name: 'token1', outputs: [ { name: '', type: 'address' } ], payable: false, stateMutability: 'view', type: 'function' }
];

async function main(): Promise<void> {
  const env = loadEnv();
  const program = new Command();
  program.option('-a, --asset <address>', 'ERC20 asset address to check').parse(process.argv);
  const { asset } = program.opts<{ asset?: string }>();

  if (!env.COMET_ADDRESS) throw new Error('COMET_ADDRESS not set');
  const provider = new JsonRpcProvider(env.RPC_URL);
  const comet = new Contract(env.COMET_ADDRESS, CometAbi as any, provider);

  const numAssets = Number(await comet.numAssets().catch(() => 0));
  const targets: string[] = [];
  if (asset) targets.push(asset);
  else {
    for (let i = 0; i < numAssets; i++) {
      const info = await comet.getAssetInfo(i);
      targets.push(info.asset);
    }
  }

  for (const token of targets) {
    const oracleRaw = (await comet.getPrice(token).catch(() => 0n)) as bigint;
    const oracle = oracleRaw > 0n ? Number(formatUnits(oracleRaw, 8)) : null;

    let dex: number | null = null;
    try {
      const pairAddr = pairFor(token, USDC);
      const pair = new Contract(pairAddr, PairAbi as any, provider);
      const [r0, r1] = await pair.getReserves().then((r: any) => [Number(r._reserve0), Number(r._reserve1)]);
      const t0 = await pair.token0();
      if (r0 > 0 && r1 > 0) {
        if (t0.toLowerCase() === token.toLowerCase()) dex = r1 / r0; else dex = r0 / r1;
      }
    } catch {}

    let deviation: number | null = null;
    if (oracle !== null && dex !== null && dex > 0) {
      deviation = Math.abs(oracle - dex) / dex;
    }

    console.log({ token, oracle, dex, deviation });
  }
}

main().catch((err) => { console.error(err); process.exit(1); }); 