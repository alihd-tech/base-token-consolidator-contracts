# Base Token Consolidator Contracts

Standalone Solidity contracts for consolidating explicitly approved ERC-20 balances on Base.

## Scope

This repository contains only the smart-contract layer. The Next.js frontend should consume the deployed contract address and ABI separately.

The first version intentionally keeps the on-chain surface small:

- pull only token amounts explicitly approved by the caller
- send collected tokens directly to a configured treasury
- batch multiple ERC-20 tokens from the same caller
- two-step ownership through OpenZeppelin `Ownable2Step`
- owner-only treasury updates
- owner-only recovery of tokens accidentally sent to the contract
- no arbitrary external calls
- no DEX router or swapping logic yet

## Networks

- Base Mainnet: chain ID `8453`
- Base Sepolia: chain ID `84532`

## Contract flow

```text
source wallet
    |
    | ERC20.approve(TokenConsolidator, exactAmount)
    v
TokenConsolidator.collect(token, amount)
    |
    | ERC20.transferFrom(source, treasury, amount)
    v
treasury
```

During normal collection the `TokenConsolidator` does not custody the asset. The token moves directly from the caller to the treasury.

## Development

```bash
npm install
cp .env.example .env
npm run compile
npm test
```

Hardhat 3 is configured with an OP Stack simulated network for local testing plus Base Sepolia and Base HTTP networks.

## Deployment

Never commit your deployer private key.

Replace the placeholder addresses in an Ignition parameter file with your real owner and dedicated treasury addresses. Then deploy to Base Sepolia first:

```bash
npx hardhat ignition deploy ignition/modules/TokenConsolidator.ts \
  --network baseSepolia \
  --parameters ignition/parameters/base-sepolia.json
```

After testnet validation, create a separate mainnet parameter file and deploy to Base:

```bash
npx hardhat ignition deploy ignition/modules/TokenConsolidator.ts \
  --network base \
  --parameters ignition/parameters/base.json
```

## Frontend interaction

The eventual frontend flow for one token is:

1. Read the wallet's token balance.
2. Simulate the token transfer/collection path before presenting it to the user.
3. Ask the wallet to approve only the exact amount intended for consolidation.
4. Call `collect(token, amount)` from that same wallet.
5. Wait for confirmation and verify the treasury balance increased.

For several tokens from the same wallet, approve each exact amount and call `collectBatch(tokens, amounts)` once.

## Security model

Unsolicited airdrops should be treated as hostile until independently assessed. A frontend or backend scanner should not infer safety from token names, symbols, logos, or wallet-displayed prices.

Do not let token metadata supply arbitrary calldata. Do not implement generic `call`, `delegatecall`, or arbitrary router execution in this collector. Swap functionality should live in a separately reviewed module or off-chain execution path with strict router allowlisting and simulation.

Approvals should be exact and short-lived wherever practical. The treasury should be a dedicated wallet rather than a wallet holding unrelated valuable assets.

## Files

```text
contracts/
  TokenConsolidator.sol
  mocks/MockERC20.sol
ignition/
  modules/TokenConsolidator.ts
  parameters/base-sepolia.json
test/
  TokenConsolidator.ts
hardhat.config.ts
.env.example
```

## License

MIT
