import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { parseEther, zeroAddress } from "viem";

describe("TokenConsolidator", async function () {
  const { viem } = await network.connect("hardhatOp");

  async function deployFixture() {
    const [owner, user, treasury, nextTreasury, attacker] =
      await viem.getWalletClients();

    const token = await viem.deployContract("MockERC20");
    const token2 = await viem.deployContract("MockERC20");
    const consolidator = await viem.deployContract("TokenConsolidator", [
      owner.account.address,
      treasury.account.address,
    ]);

    return {
      owner,
      user,
      treasury,
      nextTreasury,
      attacker,
      token,
      token2,
      consolidator,
    };
  }

  it("collects an approved token amount directly into the treasury", async function () {
    const { user, treasury, token, consolidator } = await deployFixture();
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

  it("collects multiple approved tokens atomically", async function () {
    const { user, treasury, token, token2, consolidator } = await deployFixture();
    const amount1 = parseEther("4");
    const amount2 = parseEther("9");

    await token.write.mint([user.account.address, amount1]);
    await token2.write.mint([user.account.address, amount2]);
    await token.write.approve([consolidator.address, amount1], {
      account: user.account,
    });
    await token2.write.approve([consolidator.address, amount2], {
      account: user.account,
    });

    await consolidator.write.collectBatch(
      [[token.address, token2.address], [amount1, amount2]],
      { account: user.account },
    );

    assert.equal(await token.read.balanceOf([treasury.account.address]), amount1);
    assert.equal(await token2.read.balanceOf([treasury.account.address]), amount2);
    assert.equal(await token.read.balanceOf([consolidator.address]), 0n);
    assert.equal(await token2.read.balanceOf([consolidator.address]), 0n);
  });

  it("reverts the whole batch when a later transfer cannot be completed", async function () {
    const { user, treasury, token, token2, consolidator } = await deployFixture();
    const amount = parseEther("5");

    await token.write.mint([user.account.address, amount]);
    await token2.write.mint([user.account.address, amount]);
    await token.write.approve([consolidator.address, amount], {
      account: user.account,
    });
    // token2 intentionally has no allowance.

    await assert.rejects(
      consolidator.write.collectBatch(
        [[token.address, token2.address], [amount, amount]],
        { account: user.account },
      ),
    );

    assert.equal(await token.read.balanceOf([user.account.address]), amount);
    assert.equal(await token.read.balanceOf([treasury.account.address]), 0n);
  });

  it("rejects invalid collection inputs", async function () {
    const { user, token, consolidator } = await deployFixture();

    await assert.rejects(
      consolidator.write.collect([zeroAddress, 1n], { account: user.account }),
    );
    await assert.rejects(
      consolidator.write.collect([token.address, 0n], { account: user.account }),
    );
    await assert.rejects(
      consolidator.write.collectBatch([[], []], { account: user.account }),
    );
    await assert.rejects(
      consolidator.write.collectBatch([[token.address], []], {
        account: user.account,
      }),
    );
  });

  it("allows only the owner to update the treasury and rejects zero address", async function () {
    const { owner, user, nextTreasury, consolidator } = await deployFixture();

    await assert.rejects(
      consolidator.write.setTreasury([nextTreasury.account.address], {
        account: user.account,
      }),
    );
    await assert.rejects(
      consolidator.write.setTreasury([zeroAddress], { account: owner.account }),
    );

    await consolidator.write.setTreasury([nextTreasury.account.address], {
      account: owner.account,
    });

    assert.equal(
      (await consolidator.read.treasury()).toLowerCase(),
      nextTreasury.account.address.toLowerCase(),
    );
  });

  it("uses the updated treasury for future collections", async function () {
    const { owner, user, treasury, nextTreasury, token, consolidator } =
      await deployFixture();
    const amount = parseEther("2");

    await consolidator.write.setTreasury([nextTreasury.account.address], {
      account: owner.account,
    });
    await token.write.mint([user.account.address, amount]);
    await token.write.approve([consolidator.address, amount], {
      account: user.account,
    });
    await consolidator.write.collect([token.address, amount], {
      account: user.account,
    });

    assert.equal(await token.read.balanceOf([treasury.account.address]), 0n);
    assert.equal(
      await token.read.balanceOf([nextTreasury.account.address]),
      amount,
    );
  });

  it("restricts accidental-token recovery to the owner", async function () {
    const { owner, attacker, treasury, token, consolidator } =
      await deployFixture();
    const amount = parseEther("3");

    await token.write.mint([consolidator.address, amount]);

    await assert.rejects(
      consolidator.write.recoverToken(
        [token.address, treasury.account.address, amount],
        { account: attacker.account },
      ),
    );

    await consolidator.write.recoverToken(
      [token.address, treasury.account.address, amount],
      { account: owner.account },
    );

    assert.equal(await token.read.balanceOf([consolidator.address]), 0n);
    assert.equal(await token.read.balanceOf([treasury.account.address]), amount);
  });

  it("uses two-step ownership transfer", async function () {
    const { owner, user, nextTreasury, consolidator } = await deployFixture();

    await consolidator.write.transferOwnership([user.account.address], {
      account: owner.account,
    });

    assert.equal(
      (await consolidator.read.owner()).toLowerCase(),
      owner.account.address.toLowerCase(),
    );
    assert.equal(
      (await consolidator.read.pendingOwner()).toLowerCase(),
      user.account.address.toLowerCase(),
    );

    await assert.rejects(
      consolidator.write.setTreasury([nextTreasury.account.address], {
        account: user.account,
      }),
    );

    await consolidator.write.acceptOwnership({ account: user.account });

    assert.equal(
      (await consolidator.read.owner()).toLowerCase(),
      user.account.address.toLowerCase(),
    );

    await consolidator.write.setTreasury([nextTreasury.account.address], {
      account: user.account,
    });
  });
});
