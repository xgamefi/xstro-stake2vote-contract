import { expect } from "chai";
import { Wallet } from "ethers";
import { ethers } from "hardhat";
import {
  deployContract,
  IHardhatTestCtx,
  getFee,
  eth2Wei,
  packedKeccak256,
  getSignMsg
} from "./helper";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { XstroVote } from "../typechain-types/contracts/base";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const CONTRACT_NAME = "XstroVote";
type ContractType = XstroVote;
const authorizerPriKey = "0x6fa6637c04416ea24c70407f791317abc265a746aaa1538fc3c7aa384bbc74fd"; // fake priKey

describe(CONTRACT_NAME, function () {
  let contract: ContractType;
  let contractAddr: string;
  let contractOwnerCalls: ContractType;
  let contractUser1Calls: ContractType;
  let contractUser2Calls: ContractType;
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let authorizerWallet: Wallet;
  const notAOwnerErrMsg = "Ownable: caller is not the owner";
  const fakeYield = (amountInEth: number) =>
    owner.sendTransaction({
      to: contractAddr,
      value: eth2Wei(amountInEth)
    });
  const stakeAndVote = (signer: HardhatEthersSigner, select: number, amountInEth: number) =>
    contract.connect(signer).stakeAndVote(select, {
      value: eth2Wei(amountInEth)
    });
  before(() => {
    authorizerWallet = new Wallet(authorizerPriKey);
  });
  beforeEach(async function () {
    const ctx = await deployContract<ContractType>(CONTRACT_NAME, [authorizerWallet.address]);
    contract = ctx.contract;
    contractAddr = ctx.contractAddress;
    owner = ctx.accounts.owner;
    user1 = ctx.accounts.user1;
    user2 = ctx.accounts.user2;
    contractOwnerCalls = contract.connect(owner);
    contractUser1Calls = contract.connect(user1);
    contractUser2Calls = contract.connect(user2);
  });
  describe("setVotingOpen", () => {
    describe("when caller is not the owner", async () => {
      it("should revert", async () => {
        await expect(contractUser1Calls.setVotingOpen(true)).revertedWith(notAOwnerErrMsg);
      });
    });
    describe("when caller is owner", () => {
      it("should emit VotingOpen event when it set to open", async () => {
        await expect(contractOwnerCalls.setVotingOpen(true)).emit(contract, "VotingOpen");
      });
      it("should emit VotingClosed event when it set to close", async () => {
        await expect(contractOwnerCalls.setVotingOpen(false)).emit(contract, "VotingClosed");
      });
    });
  });
  describe("stake and vote", function () {
    const stakeAmount1 = eth2Wei(1);
    const stakeAmount2 = eth2Wei(9);

    it("should revert if voting is closed", async () => {
      await expect(contractUser1Calls.stakeAndVote(1, { value: stakeAmount1 })).revertedWith(
        "voting is closed"
      );
    });
    describe("when vote is opened", () => {
      beforeEach(async () => {
        await contractOwnerCalls.setVotingOpen(true);
      });
      it("should revert if value = 0", async () => {
        await expect(contractUser1Calls.stakeAndVote(1, { value: 0 })).revertedWith(
          "value must > 0"
        );
      });
      it("should revert if sender is voted", async () => {
        await contractUser1Calls.stakeAndVote(1, { value: stakeAmount1 });
        await expect(contractUser1Calls.stakeAndVote(1, { value: stakeAmount1 })).revertedWith(
          "already voted"
        );
      });
      it("should allow users to stake and vote", async function () {
        // user1 and user2 stakes and votes
        await contractUser1Calls.stakeAndVote(1, { value: stakeAmount1 });
        await contractUser2Calls.stakeAndVote(1, { value: stakeAmount2 });
        // // Yield
        const ethYield = 1;
        await fakeYield(ethYield);
        // // Owner sets winning teams
        await contractOwnerCalls.setWinningTeams([1, 2, 3]);
        expect(await contract.finalTotalYield()).equal(eth2Wei(1));
        expect(await contract.totalBetsForTeam(1)).equal(eth2Wei(10));
        expect((await contract.bets(user1)).amount).equal(eth2Wei(1));
        expect((await contract.bets(user2)).amount).equal(eth2Wei(9));
        expect(await contract.voteOpen()).equal(false);
      });
    });
  });
  describe("claimCapitalAndPrize", () => {
    it("should revert if withdrawal is off", async () => {
      expect(await contract.isWithdrawalAllowed()).eq(false);
      await expect(
        contractUser1Calls.claimCapitalAndPrize(0, 0, ethers.ZeroHash, ethers.ZeroHash)
      ).revertedWith("withdrawal is off");
    });
    it("should revert if user never stake", async () => {
      await contractOwnerCalls.setWithdrawalToggle(true);
      await expect(
        contractUser1Calls.claimCapitalAndPrize(0, 0, ethers.ZeroHash, ethers.ZeroHash)
      ).revertedWith("must be staking");
    });
    describe("when user staked and allow withdrawal", () => {
      const depositAmountInEth = 1.234567;
      const depositAmountInWei = eth2Wei(depositAmountInEth);
      const ethYield = 0.99;
      const selectedTeam = 1;
      beforeEach(async () => {
        await contractOwnerCalls.setVotingOpen(true);
        await contractOwnerCalls.setWithdrawalToggle(true);
        await stakeAndVote(user1, selectedTeam, depositAmountInEth);
      });
      it("should revert if staking time is not enough", async () => {
        const limit = 10000000;
        await contractOwnerCalls.setMinWithdrawalInterval(limit);
        const tx = contractUser1Calls.claimCapitalAndPrize(0, 0, ethers.ZeroHash, ethers.ZeroHash);
        await expect(tx).revertedWith("less than stake threshold");
      });
      describe("when staking time is enough (withdrawal part is valid, testing claimable part)", () => {
        const minWithdrawalInterval = 123;
        beforeEach(async () => {
          await contractOwnerCalls.setMinWithdrawalInterval(minWithdrawalInterval);
          await time.increase(minWithdrawalInterval + 1);
        });
        it("should revert if prize is less than zero", async () => {
          const tx = contractUser1Calls.claimCapitalAndPrize(
            0,
            0,
            ethers.ZeroHash,
            ethers.ZeroHash
          );
          await expect(tx).revertedWith("amount must be > 0");
        });
        it("should revert if nonce is invalid", async () => {
          const tx = contractUser1Calls.claimCapitalAndPrize(
            1,
            1,
            ethers.ZeroHash,
            ethers.ZeroHash
          );
          await expect(tx).revertedWith("invalid nonce");
        });
        describe("when prize (amount) and nonce is valid", () => {
          const prizeInEth = 0.5;
          const prizeInWei = eth2Wei(prizeInEth);
          const validNonce = 0;
          let validHash: string;
          beforeEach(async () => {
            validHash = packedKeccak256(user1.address, prizeInEth, validNonce);
          });
          it("should revert if digest is invalid", async () => {
            const tx = contractUser1Calls.claimCapitalAndPrize(
              prizeInWei,
              validNonce,
              ethers.ZeroHash,
              ethers.ZeroHash
            );
            await expect(tx).revertedWith("invalid digest");
          });
          it("should revert if signature is invalid （not from auth wallet)", async () => {
            const { digest, signature } = await getSignMsg(owner, validHash);
            const tx = contractUser1Calls.claimCapitalAndPrize(
              prizeInWei,
              validNonce,
              digest,
              signature
            );
            await expect(tx).revertedWith("not authorized");
          });
          it("should emit event if every checking is passed", async () => {
            await fakeYield(ethYield);
            const { digest, signature } = await getSignMsg(authorizerWallet, validHash);
            const tx = contractUser1Calls.claimCapitalAndPrize(
              prizeInWei,
              validNonce,
              digest,
              signature
            );
            await expect(tx)
              .emit(contract, "Withdrawal")
              .withArgs(user1.address, depositAmountInWei.toString(), eth2Wei(ethYield))
              .emit(contract, "Claim")
              .withArgs(user1.address, prizeInWei, validNonce)
              .emit(contract, "ClaimCapitalAndPrize")
              .withArgs(user1.address, eth2Wei(depositAmountInEth), prizeInWei, validNonce);
          });
        });
      });
    });
  });
});
