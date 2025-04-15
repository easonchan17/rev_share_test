// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "./TestToken.sol";

contract USDC is TestToken {
    constructor (
        uint initialMintedAmount
    ) TestToken("USDC TOKEN", "USDC", initialMintedAmount) {
    }
}
