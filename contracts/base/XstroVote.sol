//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./XstroVault.sol";
import "./XstroClaim.sol";

//XstroVote
contract XstroVote is XstroVault, XstroClaim {
  struct Bet {
    uint amount;
    uint teamId;
  }

  constructor(address _addr) XstroClaim(_addr) {}

  mapping(address => Bet) public bets;
  mapping(uint => uint) public totalBetsForTeam;
  uint[3] public winningTeams;
  bool public voteOpen;
  uint public finalTotalYield;

  event VotingOpen();
  event VotingClosed();
  event Voted(address indexed voter, uint teamId, uint capital);
  event WinnersSet(uint[3] winningTeams);
  event ClaimCapitalAndPrize(address claimer, uint256 capital, uint256 prize, uint256 nonce);

  modifier votingOpen() {
    require(voteOpen, "voting is closed");
    _;
  }

  function setVotingOpen(bool _open) public onlyOwner {
    voteOpen = _open;
    if (voteOpen) {
      emit VotingOpen();
    } else {
      emit VotingClosed();
    }
  }

  function stakeAndVote(uint teamId) external payable votingOpen {
    require(msg.value > 0, "value must > 0");
    Bet storage userBet = bets[msg.sender];
    require(userBet.amount == 0, "already voted");

    userBet.amount = msg.value;
    userBet.teamId = teamId;
    totalBetsForTeam[teamId] += msg.value;

    _deposit();

    emit Voted(msg.sender, teamId, msg.value);
  }

  function setWinningTeams(uint[3] calldata _winningTeams) external onlyOwner {
    winningTeams = _winningTeams;
    voteOpen = false;
    (, , uint256 yield) = totalYield();
    finalTotalYield = yield;
    emit WinnersSet(winningTeams);
  }

  // Prize refer to the additinal earn from capital
  // The function sends back the caller the capital (deposit) and the prize (earn if win)
  function claimCapitalAndPrize(
    uint256 _prize,
    uint256 _nonce,
    bytes32 _digest,
    bytes memory _signature
  ) public {
    uint256 capital = _withdrawal();
    _claim(_prize, _nonce, _digest, _signature);
    emit ClaimCapitalAndPrize(msg.sender, capital, _prize, _nonce);
  }
}
