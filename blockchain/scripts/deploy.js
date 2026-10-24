const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Starting BloodSupplyChain deployment...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contract with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");

  const BloodSupplyChain = await hre.ethers.getContractFactory("BloodSupplyChain");
  const contract = await BloodSupplyChain.deploy();
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log("BloodSupplyChain deployed successfully to:", contractAddress);

  // Save contract address and ABI to backend config
  const contractArtifact = await hre.artifacts.readArtifact("BloodSupplyChain");
  const deployInfo = {
    address: contractAddress,
    deployer: deployer.address,
    network: hre.network.name,
    deployedAt: new Date().toISOString(),
    abi: contractArtifact.abi,
  };

  const outputDirs = [
    path.join(__dirname, "../deployments"),
    path.join(__dirname, "../../backend/src/config"),
  ];

  outputDirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(dir, "BloodSupplyChain.json"),
      JSON.stringify(deployInfo, null, 2)
    );
  });

  console.log("Deployment information saved to deployments/ and backend/src/config/");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
