---
name: vm-status
description: "Check Hetzner VM sweep status: games completed, errors/bugs with seeds, max fame leaderboard. Use when user asks about VM status, sweep progress, bugs, or fame."
user-invocable: true
---

# Check VM Sweep Status

SSH into the Hetzner VM and report on the current sweep's progress, errors, and fame leaderboard.

## What is the VM?

A Hetzner Cloud VPS (CPX11, 2 vCPU, 2GB RAM, 40GB disk) running the Mage Knight game server and a continuous 1M-game random sweep. It auto-deploys from `main` every 5 minutes via cron (`/root/auto-deploy.sh`). The sweep acts as a fuzzer — hammering the game engine with random actions to find validator/validActions mismatches and other edge-case bugs.

Infrastructure is defined in `terraform/hetzner-mage-knight/` (Terraform + cloud-init).

## VM Details

- **IP**: `178.156.209.72` (also available via `terraform output` in `terraform/hetzner-mage-knight/`)
- **SSH**: `ssh -i ~/.ssh/id_ed25519 -o StrictHostKeyChecking=no root@178.156.209.72`
- **Sweep log**: `/tmp/sweep-1M.log`
- **Summary file**: `/root/MageKnight/packages/python-sdk/sim-artifacts/run_summary.ndjson`
- **Deploy log**: `/var/log/mage-knight-deploy.log`

## Workflow

### 1. Check sweep is running and get basic stats

```bash
ssh -i ~/.ssh/id_ed25519 -o StrictHostKeyChecking=no root@178.156.209.72 '
echo "=== Deploy ==="
tail -2 /var/log/mage-knight-deploy.log 2>/dev/null

echo ""
echo "=== tmux ==="
tmux ls 2>/dev/null || echo "no tmux session (sweep not running!)"

echo ""
echo "=== Games completed ==="
wc -l /root/MageKnight/packages/python-sdk/sim-artifacts/run_summary.ndjson 2>/dev/null || echo "no summary file"
'
```

### 2. Get all unique errors with counts

```bash
ssh -i ~/.ssh/id_ed25519 -o StrictHostKeyChecking=no root@178.156.209.72 '
grep "FAIL" /tmp/sweep-1M.log | sed "s/.*reason=//" | sort | uniq -c | sort -rn
'
```

For each unique error, also get one example seed:

```bash
ssh -i ~/.ssh/id_ed25519 -o StrictHostKeyChecking=no root@178.156.209.72 '
grep "FAIL" /tmp/sweep-1M.log
'
```

### 3. Get fame leaderboard

```bash
ssh -i ~/.ssh/id_ed25519 -o StrictHostKeyChecking=no root@178.156.209.72 'cd /root/MageKnight/packages/python-sdk && python3 -c "
import json
top = []
with open(\"sim-artifacts/run_summary.ndjson\") as f:
    for line in f:
        r = json.loads(line)
        top.append((r[\"max_fame\"], r[\"seed\"], r[\"steps\"], r[\"fame_by_player\"]))
top.sort(key=lambda x: -x[0])
total = len(top)
nz = sum(1 for f, _, _, _ in top if f > 0)
print(f\"Total games: {total}\")
print(f\"Games with fame>0: {nz} ({100*nz/total:.1f}%)\")
print()
print(f\"Top 10:\")
for fame, seed, steps, by_player in top[:10]:
    print(f\"  fame={fame}  seed={seed}  steps={steps}  {by_player}\")
"'
```

## Report Format

Present results as:

```
## VM Sweep Status

**Commit**: <sha from deploy log>
**Deployed**: <timestamp from deploy log>
**Sweep**: running/not running
**Games completed**: N

### Errors (X total failures)

| Bug | Count | Example Seed |
|-----|-------|-------------|
| <error message> | N | <seed> |

(or "No errors!" if clean)

### Fame Leaderboard (top 5)

| Rank | Fame | Seed | Steps | Players |
|------|------|------|-------|---------|
| 1 | N | <seed> | N | <fame_by_player> |

**Games with fame > 0**: N/total (X.X%)
```

## Notes

- If sweep is not running (no tmux session), alert the user
- If summary file doesn't exist, a deploy may have just cleaned it — note this
- Disconnect errors are usually from server restarts during deploys, not real bugs
- The interesting bugs are `invariant_failure` outcomes where validActions disagrees with validators
