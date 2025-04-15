import { HardhatUserConfig} from "hardhat/config";

import "@nomiclabs/hardhat-ethers";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "hardhat-deploy";
import "hardhat-contract-sizer";

import * as dotenv from "dotenv";
dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.4",
        settings: {
          optimizer: {
            enabled: true
          }
        }
      }
    ]
  },
  networks: {
    core_local: {
      url: "http://127.0.0.1:8579",
      chainId: 2888,
      gasPrice: 35000000000,
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY]:[],
    }
  },
  paths: {
		artifacts: "artifacts",
		deployments: "deployments",
  },
  typechain: {
		outDir: "src/types",
		target: "ethers-v5",
  },
  namedAccounts: {
		deployer: {
			default: 0,
		},
  },
  gasReporter: {
		enabled: true,
		currency: "USD",
  }
};

export default config;
