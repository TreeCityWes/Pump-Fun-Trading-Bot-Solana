// risk-check-example.mjs
//
// Optional pre-buy insider-cluster check via RiskDataApi (tnt-audit.com).
// Standalone example — not wired into script.mjs directly, since this repo
// keeps everything in one file and I didn't want to touch your main bot
// loop without knowing exactly where you'd want the gate. Drop
// checkTokenRisk() into script.mjs's buy path if useful.
//
// Traces top holders back to their first funder — catches supply
// deliberately split across several wallets funded by the same source,
// which raw holder-count/percentage checks can miss.
//
// 5 free calls/day, no signup. Set RISK_API_KEY in .env for 15/day
// (free, email only, no card). Get a key: https://tnt-audit.com/risk-api
//
// Usage: node risk-check-example.mjs <mint_address>

import 'dotenv/config';
import axios from 'axios';

const RISK_API_URL = 'https://tnt-audit.com/api/v1/token-risk';

async function checkTokenRisk(mint, maxClusterPercent = 50) {
  const headers = {};
  if (process.env.RISK_API_KEY) {
    headers.Authorization = `Bearer ${process.env.RISK_API_KEY}`;
  }

  try {
    const { data } = await axios.get(RISK_API_URL, {
      params: { mint },
      headers,
      timeout: 5000,
    });

    const clusters = data.insider_clusters ?? [];
    const worst = clusters.reduce((max, c) => Math.max(max, c.percent_of_supply ?? 0), 0);

    return {
      ok: worst <= maxClusterPercent,
      safetyScore: data.safety_score,
      worstClusterPercent: worst,
    };
  } catch (error) {
    // Fail open — this is a safety-net check, never a hard dependency.
    console.warn('Risk API unavailable, skipping check:', error.message);
    return { ok: true, safetyScore: null, worstClusterPercent: 0 };
  }
}

const mint = process.argv[2];
if (!mint) {
  console.log('Usage: node risk-check-example.mjs <mint_address>');
  process.exit(1);
}

const result = await checkTokenRisk(mint);
console.log(`mint: ${mint}`);
console.log(`safety_score: ${result.safetyScore}`);
console.log(`worst insider cluster: ${result.worstClusterPercent.toFixed(1)}% of supply`);
console.log(result.ok ? '-> PASS' : '-> FAIL (would skip this buy)');
