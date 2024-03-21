//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../base/XstroClaim.sol";

contract XstroClaimTestable is XstroClaim {
  constructor(address _addr) XstroClaim(_addr) {}

  function claim(uint256 _amount, uint256 _nonce, bytes32 _digest, bytes memory _signature) public {
    _claim(_amount, _nonce, _digest, _signature);
  }

  function getHash(uint256 _amount, uint256 _nonce) public view returns (bytes32) {
    return _getHash(_amount, _nonce);
  }

  receive() external payable {}
}
