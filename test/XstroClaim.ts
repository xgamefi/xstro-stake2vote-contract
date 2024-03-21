import { expect } from "chai";
import { Wallet, ethers } from "ethers";
import { deployContract, getFee, eth2Wei, packedKeccak256, getSignMsg, balance } from "./helper";
import { XstroClaimTestable } from "../typechain-types/contracts/testable";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const CONTRACT_NAME = "XstroClaimTestable";
type ContractType = XstroClaimTestable;
const authorizerPriKey = "0x6fa6637c04416ea24c70407f791317abc265a746aaa1538fc3c7aa384bbc74fd"; // fake priKey
// 0x4F7a7Ea3F66229f0A28E61a4a3ae862be3915e78
describe(CONTRACT_NAME, function () {
  let contract: ContractType;
  let contractAddr: string;
  let contractOwnerCalls: ContractType;
  let contractUserCalls: ContractType;
  let owner: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let authorizerWallet: Wallet;

  const fakeYield = (amountInEth: number) =>
    owner.sendTransaction({
      to: contractAddr,
      value: eth2Wei(amountInEth)
    });

  before(() => {
    authorizerWallet = new Wallet(authorizerPriKey);
  });
  beforeEach(async () => {
    const ctx = await deployContract<ContractType>(CONTRACT_NAME, [authorizerWallet.address]);
    contract = ctx.contract;
    contractAddr = ctx.contractAddress;
    owner = ctx.accounts.owner;
    user = ctx.accounts.user1;
    contractOwnerCalls = contract.connect(owner);
    contractUserCalls = contract.connect(user);
  });
  describe("getHash", () => {
    it("should return valid hash", async () => {
      const address = user.address;
      const amountInEth = 9;
      const nonce = 7;
      const expected = packedKeccak256(address, amountInEth, nonce);
      expect(await contractUserCalls.getHash(eth2Wei(amountInEth), nonce)).eq(expected);
    });
  });
  describe("claim", () => {
    it("should revert if amount is zero", async () => {
      await expect(contractOwnerCalls.claim(0, 0, ethers.ZeroHash, ethers.ZeroHash)).revertedWith(
        "amount must be > 0"
      );
    });
    it("should revert if nonce is invalid", async () => {
      await expect(contractOwnerCalls.claim(1, 1, ethers.ZeroHash, ethers.ZeroHash)).revertedWith(
        "invalid nonce"
      );
    });
    it("should revert if digest is invalid", async () => {
      await expect(contractOwnerCalls.claim(1, 0, ethers.ZeroHash, ethers.ZeroHash)).revertedWith(
        "invalid digest"
      );
    });
    it("should revert if it's not from auth signer", async () => {
      const sender = user.address;
      const amountInEth = 1;
      const nonce = 0;
      const hash = packedKeccak256(sender, amountInEth, nonce);
      const { digest, signature } = await getSignMsg(owner, hash);
      await expect(
        contractUserCalls.claim(eth2Wei(amountInEth), nonce, digest, signature)
      ).revertedWith("not authorized");
    });
    it("should revert if params are correct but contract does not have enough amount", async () => {
      const sender = user.address;
      const amountInEth = 999999;
      const nonce = 0;
      const hash = packedKeccak256(sender, amountInEth, nonce);
      const { digest, signature } = await getSignMsg(authorizerWallet, hash);
      await expect(
        contractUserCalls.claim(eth2Wei(amountInEth), nonce, digest, signature)
      ).revertedWithCustomError(contract, "NativeTokenTransferError");
    });
    it("should send native amount and emit event if successful", async () => {
      const ethYield = 1000;
      await fakeYield(1000);
      // Assure contract balance
      expect(await balance(contractAddr)).eq(eth2Wei(1000));

      const sender = user.address;
      const amountInEth = 10;
      const nonce = 0;
      const hash = packedKeccak256(sender, amountInEth, nonce);
      const { digest, signature } = await getSignMsg(authorizerWallet, hash);

      const beforeWei = await balance(sender);
      const tx = await contractUserCalls.claim(eth2Wei(amountInEth), nonce, digest, signature);
      await expect(tx).emit(contract, "Claim").withArgs(sender, eth2Wei(amountInEth), nonce);
      const fee = await getFee(tx);
      const afterEth = await balance(sender);
      const expectedEth = afterEth - beforeWei + fee;
      expect(expectedEth).eq(eth2Wei(amountInEth));
    });
  });
});
