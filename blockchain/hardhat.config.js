require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1,
      },
      viaIR: true,
    },
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:7545",
      allowUnlimitedContractSize: true,
    },
    ganache: {
      url: "http://127.0.0.1:7545",
      allowUnlimitedContractSize: true,
    },
    ganacheGui: {
      url: "http://127.0.0.1:7545",
      allowUnlimitedContractSize: true,
    },
    hardhat: {
      chainId: 31337,
      allowUnlimitedContractSize: true,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
