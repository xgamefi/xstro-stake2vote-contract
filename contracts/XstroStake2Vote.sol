//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./base/XstroVote.sol";

contract XstroStake2Vote is XstroVote {
  constructor(address _addr) XstroVote(_addr) {
    configureAutomaticYield();
  }
}
