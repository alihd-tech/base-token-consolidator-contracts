import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { parseEther } from "viem";

describe("TokenConsolidator", async function () {
  const { viem } = await network.connect("hardhatOp");

  it("collects an approved token amount directly into the treasury", async function () {
    const [owner, user, treasury] = await viem.getWalletClients();

    const token = await viem.deployContract("MockERC20");
    const consolidator = await viem.deployContract("TokenConsolidator", [
      owner.account.address,
      treasury.account.address,
    ]);

    const amount = parseEther("100");

    await token.write.mint([user.account.address, amount]);
    await token.write.approve([consolidator.address, amount], {
      account: user.account,
    });
    await consolidator.write.collect([token.address, amount], {
      account: user.account,
    });

    assert.equal(await token.read.balanceOf([user.account.address]), 0n);
    assert.equal(await token.read.balanceOf([treasury.account.address]), amount);
    assert.equal(await token.read.balanceOf([consolidator.address]), 0n);
  });

  it("allows only the owner to update the treasury", async function () {
    const [owner, user, treasury, nextTreasury] = await viem.getWalletClients();

    const consolidator = await viem.deployContract("TokenConsolidator", [
      owner.account.address,
      treasury.account.address,
    ]);

    await assert.rejects(
      consolidator.write.setTreasury([nextTreasury.account.address], {
        account: user.account,
      }),
    );

    await consolidator.write.setTreasury([nextTreasury.account.address], {
      account: owner.account,
    });

    assert.equal(
      (await consolidator.read.treasury()).toLowerCase(),
      nextTreasury.account.address.toLowerCase(),
    );
  });
});
