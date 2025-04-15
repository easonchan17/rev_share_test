// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "./TestToken.sol";

contract USDT is TestToken {
    constructor (
        uint initialMintedAmount
    ) TestToken("USDT TOKEN", "USDT", initialMintedAmount) {
    }
}
