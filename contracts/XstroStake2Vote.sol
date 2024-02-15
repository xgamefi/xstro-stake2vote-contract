//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./base/XstroVote.sol";
import "./base/XstroClaim.sol";

contract XstroStake2Vote is XstroClaim, XstroVote {
  constructor(address _addr) XstroClaim(_addr) {
    configureAutomaticYield();
  }

  function claim(
    uint256 _amount,
    uint256 _nonce,
    bytes32 _digest,
    bytes memory _signature
  ) public nonReentrant {
    _claim(_amount, _nonce, _digest, _signature);
  }
}
