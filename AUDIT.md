# TokenConsolidator v1 focused audit

Date: 2026-09-10
Scope: `contracts/TokenConsolidator.sol` and its direct OpenZeppelin dependencies.

## Summary

No critical or high-severity issue was identified in the narrow v1 collection contract during this focused review. The contract intentionally has no arbitrary-call, swap-router, delegatecall, upgradeability, ETH custody, or token-pricing logic. Normal collection transfers an explicitly approved ERC-20 amount directly from `msg.sender` to the configured treasury.

This is a focused engineering review, not a substitute for an independent professional smart-contract audit before meaningful production value is placed at risk.

## Trust model

- The owner can change the treasury for future collections.
- The owner can recover ERC-20s accidentally sent to the contract.
- Ownership transfer uses OpenZeppelin `Ownable2Step`.
- Users must independently approve each token before `collect` / `collectBatch` can pull it.
- Every token contract must be treated as untrusted. A malicious or non-standard ERC-20 can revert, lie about accounting, levy transfer fees, blacklist accounts, or execute arbitrary token-side logic when called.

## Findings

### Informational: hostile-token behavior remains outside the contract's guarantees

`SafeERC20` improves compatibility with common ERC-20 return-value behavior, but it cannot prove that an arbitrary token is economically legitimate or honestly accounts for balances. The application must simulate and classify unsolicited tokens before requesting approvals or collection.

Recommendation: only surface `collect` after RPC simulation and liquidity/sellability checks; never execute token-provided URLs or arbitrary calldata.

### Informational: emitted amount is the requested amount, not guaranteed treasury balance delta

For fee-on-transfer or otherwise unusual ERC-20s, `TokenCollected.amount` records the requested transfer amount. The treasury may receive less. This is acceptable for v1 because the event describes the collection request, but downstream accounting must verify actual balances if exact proceeds matter.

### Informational: batch operation is intentionally atomic

If any token transfer in `collectBatch` reverts, the entire batch reverts. This prevents partial state from being mistaken for complete collection, but a single hostile token can block that batch.

Recommendation: the frontend should simulate each token and construct small batches of independently validated tokens. Fall back to single-token collection when isolation is useful.

### Informational: owner trust is material

The owner can redirect future collections by changing `treasury`. Two-step ownership reduces accidental owner transfer risk, but owner-key compromise remains consequential.

Recommendation: use a hardware-backed wallet or multisig for production ownership. Monitor `TreasuryUpdated`, `OwnershipTransferStarted`, and `OwnershipTransferred` events.

## Properties reviewed

- No normal token custody in the consolidator.
- No arbitrary external target/call-data execution.
- No delegatecall or upgradeability.
- No DEX/router approvals.
- Zero owner/treasury/token/recipient addresses rejected where applicable.
- Zero collection/recovery amounts rejected.
- Batch length mismatch and empty batches rejected.
- Batch transfers revert atomically on failure.
- Treasury mutation restricted to owner.
- Recovery restricted to owner.
- Ownership handoff is two-step.

## Test coverage added

The test suite covers single collection, multi-token collection, batch atomicity, invalid collection inputs, treasury authorization, updated-treasury behavior, token-recovery authorization, and two-step ownership transfer.

## Deployment recommendation

Deploy to Base Sepolia first with a dedicated test owner and treasury. Verify source, exercise approval/collection/recovery/ownership paths with test tokens, then perform a separate pre-mainnet review.
