//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./XstroVault.sol";

contract XstroVote is XstroVault {
  struct Bet {
    uint amount;
    uint teamId;
  }

  mapping(address => Bet) public bets;
  mapping(uint => uint) public totalBetsForTeam;
  uint[3] public winningTeams;
  bool public voteEnded;
  uint public finalTotalYield;

  event Voted(address indexed voter, uint teamId, uint amount);
  event WinnersSet(uint[3] winningTeams);

  modifier votingOpen() {
    require(!voteEnded, "Voting has ended");
    _;
  }

  function stakeAndVote(uint teamId) external payable votingOpen {
    require(msg.value > 0, "Stake must be greater than 0");
    Bet storage userBet = bets[msg.sender];
    require(userBet.amount == 0, "Already voted");

    userBet.amount = msg.value;
    userBet.teamId = teamId;
    totalBetsForTeam[teamId] += msg.value;

    deposit();

    emit Voted(msg.sender, teamId, msg.value);
  }

  function setWinningTeams(uint[3] calldata _winningTeams) external onlyOwner {
    winningTeams = _winningTeams;
    voteEnded = true;
    finalTotalYield = totalYield()[1];

    emit WinnersSet(winningTeams);
  }
}
