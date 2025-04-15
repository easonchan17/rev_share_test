// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import './TestToken.sol';

contract TokenTransferProxy {
    address public tokenAddress;

    event ProxyTransfer(address from, address to, uint256 amount);

    function setTokenAddress(address _tokenAddress) public {
        tokenAddress = _tokenAddress;
    }

    function proxyTransfer(address to, uint256 amount) external returns (bool) {
        require(tokenAddress != address(0), "invalid tokenAddress");

        TestToken(tokenAddress).transferFrom(msg.sender, to, amount);
        emit ProxyTransfer(msg.sender, to, amount);
        return true;
    }
}
