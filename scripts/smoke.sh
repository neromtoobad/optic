#!/usr/bin/env bash
# Smoke test: POST a read, print verdict + card_url. Usage: ./scripts/smoke.sh [base_url]
set -euo pipefail

BASE="${1:-http://localhost:3000}"

echo "── health ──"
curl -sf "$BASE/v1/health"
echo

echo "── GET on paid route (expect 405) ──"
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/v1/read"

echo "── POST /v1/read ──"
VERDICT=$(curl -sf -X POST "$BASE/v1/read" -H "Content-Type: application/json" -d '{"query":"pepe"}')
echo "$VERDICT" | node -e "
const v = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(JSON.stringify(v, null, 2));
console.log('\n── summary ──');
console.log('verdict_line:', v.verdict_line);
console.log('divergence score:', v.divergence.score);
console.log('card_url:', v.card_url, v.card_pending ? '(pending)' : '');
"
echo "smoke OK"
