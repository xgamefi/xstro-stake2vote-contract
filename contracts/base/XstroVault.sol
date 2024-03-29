//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./BlastYieldConfig.sol";
import "./common.sol";

contract XstroVault is BlastYieldConfig, ReentrancyGuard {
  mapping(address => uint256) internal balances;
  mapping(address => uint256) internal stakingTimestamp;
  uint256 public minWithdrawalInterval;
  uint256 public totalStaking;
  bool public isWithdrawalAllowed;

  struct TotalYield {
    uint256 block;
    uint256 timestamp;
    uint256 totalYield;
  }
  event Deposit(address sender, uint256 amount, uint256 contractBalance);
  event Withdrawal(address staker, uint256 amount, uint256 contractBalance);
  event SetMinWithdrawalInterval(uint256 sec);
  event WithdrawalOn();
  event WithdrawalOff();

  constructor() {
    // configureAutomaticYield();
  }

  function setMinWithdrawalInterval(uint256 sec_) external onlyOwner {
    minWithdrawalInterval = sec_;
    emit SetMinWithdrawalInterval(sec_);
  }

  function setWithdrawalToggle(bool _isWithdrawalAllowed) external onlyOwner {
    isWithdrawalAllowed = _isWithdrawalAllowed;
    if (isWithdrawalAllowed) {
      emit WithdrawalOn();
    } else {
      emit WithdrawalOff();
    }
  }

  function totalYield() public view returns (uint256, uint256, uint256) {
    return (block.number, block.timestamp, address(this).balance - totalStaking);
  }

  function userStake(address addr_) external view returns (uint256[] memory) {
    uint256[] memory out = new uint256[](2);
    out[0] = balances[addr_];
    out[1] = stakingTimestamp[addr_];
    return out;
  }

  function _deposit() internal {
    require(msg.value > 0, "value must be > 0");
    (bool sent, ) = payable(address(this)).call{ value: msg.value }("");
    if (!sent) revert NativeTokenTransferError();
    balances[msg.sender] += msg.value;
    stakingTimestamp[msg.sender] = block.timestamp;
    totalStaking += msg.value;
    emit Deposit(msg.sender, msg.value, address(this).balance);
  }

  function _withdrawal() internal returns (uint256) {
    require(isWithdrawalAllowed, "withdrawal is off");
    uint256 amount = balances[msg.sender];
    require(amount > 0, "must be staking");
    uint256 totalStakingTime = block.timestamp - stakingTimestamp[msg.sender];
    require(totalStakingTime > minWithdrawalInterval, "less than stake threshold");
    delete balances[msg.sender];
    delete stakingTimestamp[msg.sender];
    totalStaking -= amount;
    (bool sent, ) = payable(msg.sender).call{ value: amount }("");
    if (!sent) revert NativeTokenTransferError();
    emit Withdrawal(msg.sender, amount, address(this).balance);
    return amount;
  }

  function withdrawalYield() external nonReentrant onlyOwner {
    (, , uint256 yield) = totalYield();
    require(yield > 0, "yield must be > 0");
    (bool sent, ) = payable(msg.sender).call{ value: yield }("");
    if (!sent) revert NativeTokenTransferError();
  }

  receive() external payable {}
}
