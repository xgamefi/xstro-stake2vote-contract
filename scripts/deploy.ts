import hre, { ethers } from "hardhat";
// import { toWei } from "web3-utils"

async function main() {
  console.log("Selected network: ", hre.network.name);
  const contractName = "XstroStake2Vote";
  const contract = await ethers.deployContract(contractName, [
    "" // Auth address here
  ]);
  await contract.waitForDeployment();
  console.log("Address: ", await contract.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
