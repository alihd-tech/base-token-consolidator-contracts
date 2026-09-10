// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title TokenConsolidator
/// @notice Pulls explicitly approved ERC-20 balances from the caller and sends them directly to a treasury.
/// @dev The contract deliberately has no arbitrary-call or DEX-router functionality in v1.
contract TokenConsolidator is Ownable2Step {
    using SafeERC20 for IERC20;

    error ZeroAddress();
    error ZeroAmount();
    error LengthMismatch();
    error EmptyBatch();

    address public treasury;

    event TokenCollected(
        address indexed account,
        address indexed token,
        address indexed treasury,
        uint256 amount
    );

    event TreasuryUpdated(
        address indexed previousTreasury,
        address indexed newTreasury
    );

    event TokenRecovered(
        address indexed token,
        address indexed recipient,
        uint256 amount
    );

    constructor(address initialOwner, address initialTreasury) Ownable(initialOwner) {
        if (initialOwner == address(0) || initialTreasury == address(0)) {
            revert ZeroAddress();
        }

        treasury = initialTreasury;
    }

    /// @notice Collect one approved token amount from the caller into the treasury.
    function collect(address token, uint256 amount) external {
        if (token == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        IERC20(token).safeTransferFrom(msg.sender, treasury, amount);

        emit TokenCollected(msg.sender, token, treasury, amount);
    }

    /// @notice Collect several approved token amounts from the caller in one transaction.
    /// @dev A revert from any token reverts the entire batch.
    function collectBatch(
        address[] calldata tokens,
        uint256[] calldata amounts
    ) external {
        uint256 length = tokens.length;

        if (length == 0) revert EmptyBatch();
        if (length != amounts.length) revert LengthMismatch();

        address destination = treasury;

        for (uint256 i; i < length; ) {
            address token = tokens[i];
            uint256 amount = amounts[i];

            if (token == address(0)) revert ZeroAddress();
            if (amount == 0) revert ZeroAmount();

            IERC20(token).safeTransferFrom(msg.sender, destination, amount);

            emit TokenCollected(msg.sender, token, destination, amount);

            unchecked {
                ++i;
            }
        }
    }

    /// @notice Update the treasury receiving future collections.
    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();

        address previousTreasury = treasury;
        treasury = newTreasury;

        emit TreasuryUpdated(previousTreasury, newTreasury);
    }

    /// @notice Recover ERC-20 tokens accidentally sent to this contract.
    /// @dev Normal collection sends tokens directly to the treasury, so the contract should not custody balances.
    function recoverToken(
        address token,
        address recipient,
        uint256 amount
    ) external onlyOwner {
        if (token == address(0) || recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        IERC20(token).safeTransfer(recipient, amount);

        emit TokenRecovered(token, recipient, amount);
    }
}
