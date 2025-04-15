// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "./TestToken.sol";

contract TT02 is TestToken {
    uint256 public additionEventCount;

    constructor (
        uint initialMintedAmount
    ) TestToken("TEST TOKEN02", "TT02", initialMintedAmount) {
    }

     function setAdditionEventCount(uint256 count) external {
        additionEventCount = count;
    }

    function transfer(address to, uint256 amount) public virtual override returns (bool) {
        if (!super.transfer(to, amount)) return false;

        address owner = _msgSender();
        for (uint256 i = 0; i < additionEventCount; ++i) {
            emit Transfer(owner, to, amount);
        }
        return true;
    }
}
