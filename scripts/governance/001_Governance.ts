import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { Configuration } from '../common/configuration';
import { RewardRule } from '../common/rewardRule';
import { waitForInput, getContractInst } from '../common/utils';
import { assert } from 'console';
import { BigNumber } from 'ethers';
import logger from 'node-color-log';

interface Operations {
    [key: string]: (deploymens: any, deployer: any) => Promise<void>;
}

const FUNC_MAP: Operations = {
    addConfig: async function(deployments: any, deployer: any) {
        let symbol = await waitForInput("Enter The Symbol Of The Contract(e.g. USDT,USDC):");
        symbol = symbol.trim();
        if (symbol.length === 0) {
            logger.color('red').bold().log("Empty Contract Symbol ...");
            return;
        }

        logger.color('blue').bold().log(`Generate ${symbol}  Fee Config ...`);
        const contractInst = await getContractInst(deployments, "", symbol, "");
        assert(contractInst, `Unknown contract symbol ${symbol}`);

        // Random Generate a config
        const feeConfig = new Configuration();
        const rewardRule = new RewardRule(contractInst, feeConfig);

        await rewardRule.initBeneficiaries();
        rewardRule.addEvent('Transfer');
        rewardRule.addFunction('transfer');
        rewardRule.addFunction('transferFrom');

        const config = await rewardRule.generate();
        const ok = await feeConfig.addConfig(config);
        if (ok) {
            logger.color('blue').bold().log(`Add ${symbol} config success`);
        } else {
            logger.color('red').bold().log(`Add ${symbol} config failed`);
        }
    },

    getConfig: async function(deployments: any, deployer: any) {
        let symbol = await waitForInput("Enter The Symbol Of The Contract(e.g. USDT,USDC):");
        symbol = symbol.trim();
        if (symbol.length === 0) {
            logger.color('red').bold().log("Empty Contract Symbol ...");
            return;
        }

        const contractInst = await getContractInst(deployments, "", symbol, "");
        assert(contractInst, `Unknown contract symbol ${symbol}`);

        const feeConfig = new Configuration();
        const address = contractInst?.address as string;
        const adaptedConfig = await feeConfig.getConfig(address);
        assert(adaptedConfig, `Unknow contract address ${address}`);
    },

    removeConfig: async function(deployments: any, deployer: any) {
        let symbol = await waitForInput("Enter The Symbol Of The Contract(e.g. USDT,USDC):");
        symbol = symbol.trim();
        if (symbol.length === 0) {
            logger.color('red').bold().log("Empty Contract Symbol ...");
            return;
        }

        const contractInst = await getContractInst(deployments, "", symbol, "");
        assert(contractInst, `Unknown contract symbol ${symbol}`);

        const feeConfig = new Configuration();
        const ok = await feeConfig.removeConfig(contractInst?.address as string);
        if (ok) {
            logger.color('blue').bold().log(`Remove ${symbol} config success`);
        } else {
            logger.color('red').bold().log(`Remove ${symbol} config failed`);
        }
    },

    updateConfig: async function(deployments: any, deployer: any) {
        let symbol = await waitForInput("Enter The Symbol Of The Contract(e.g. USDT,USDC):");
        symbol = symbol.trim();
        if (symbol.length === 0) {
            logger.color('red').bold().log("Empty Contract Symbol ...");
            return;
        }

        const contractInst = await getContractInst(deployments, "", symbol, "");
        assert(contractInst, `Unknown contract symbol ${symbol}`);

        const feeConfig = new Configuration();
        const address = contractInst?.address as string;

        const adaptedConfig = await feeConfig.getConfig(address);
        assert(adaptedConfig, `Unknow contract address ${address}`);
        if (!adaptedConfig) return;

        // Generate new config for address then update
        const rewardRule = new RewardRule(contractInst, feeConfig);
        await rewardRule.initBeneficiaries();
        rewardRule.addEvent('Transfer');
        rewardRule.addFunction('transfer');
        rewardRule.addFunction('transferFrom');

        const config = await rewardRule.generate();
        const ok = await feeConfig.updateConfig(config);
        if (ok) {
            logger.color('blue').bold().log(`Update ${symbol} config success`);
        } else {
            logger.color('red').bold().log(`Update ${symbol} config failed`);
        }
    },

    // removeIssuer: async function(deployments: any, deployer: any) {
    //     let symbol = await waitForInput("Enter The Symbol Of The Contract(e.g. USDT,USDC):");
    //     symbol = symbol.trim();
    //     if (symbol.length === 0) {
    //         logger.color('red').bold().log("Empty Contract Symbol ...");
    //         return;
    //     }

    //     const contractInst = await getContractInst(deployments, "", symbol, "");
    //     assert(contractInst, `Unknown contract symbol ${symbol}`);

    //     const feeConfig = new Configuration();
    //     const address = contractInst?.address as string;
    //     const adaptedConfigs = feeConfig.loadConfigs();
    //     const targetConfig: AdaptConfig = adaptedConfigs[address];
    //     if (targetConfig) {
    //         console.dir(targetConfig, {depth: null, colors: true});
    //     }

    //     {// For debug
    //         const adaptedConfig = await feeConfig.getConfig(address);
    //         assert(adaptedConfig, `Unknow contract address ${address}`);
    //         if (!adaptedConfig) return;

    //         console.log(adaptedConfig, {depth: null, colors: true});
    //         assert(adaptedConfig.isActive === targetConfig.isActive)
    //     }

    //     let addresses: Record<string, boolean> = {};
    //     for (const event of targetConfig.events) {
    //         for (const reward of event.rewards) {
    //             addresses[reward.rewardAddr] = true;
    //         }
    //     }
    //     logger.color('blue').bold().log("=======Issuer Address List========");
    //     console.log(addresses);

    //     let issuer = await waitForInput("Enter The Address Of The Issuer to be removed:");
    //     issuer = issuer.trim();

    //     const ok = await feeConfig.removeIssuer(address, issuer);
    //     if (ok) {
    //         logger.color('blue').bold().log(`Remove Issuer ${issuer} from ${symbol} config success`);
    //     } else {
    //         logger.color('red').bold().log(`Remove Issuer ${issuer} from ${symbol} config failed`);
    //     }
    // },

    setConfigStatus: async function(deployments: any, deployer: any) {
        let symbol = await waitForInput("Enter The Symbol Of The Contract(e.g. USDT,USDC):");
        symbol = symbol.trim();
        if (symbol.length === 0) {
            logger.color('red').bold().log("Empty Contract Symbol ...");
            return;
        }

        const contractInst = await getContractInst(deployments, "", symbol, "");
        assert(contractInst, `Unknown contract symbol ${symbol}`);

        const feeConfig = new Configuration();
        const address = contractInst?.address as string;

        const targetConfig = await feeConfig.getConfig(address);
        assert(targetConfig, `Unknow contract address ${address}`);
        if (!targetConfig) return;

        logger.color('blue').bold().log("=======Current Config Status========");
        console.log(targetConfig.isActive);

        let newStatus = await waitForInput("Enter The New Status of the config(e.g. 1 or 0):");
        const ok = await feeConfig.setConfigStatus(address, newStatus.trim() === '1');
        if (ok) {
            logger.color('blue').bold().log(`Set ${symbol} config status success`);
        } else {
            logger.color('red').bold().log(`Set ${symbol} config status failed`);
        }
    },

    setAdditionEventCount: async function(deployments: any, deployer: any) {
        let name = await waitForInput("Enter The Name Of The Contract(e.g. TT01,TT02):");
        name = name.trim();
        if (name.length === 0) {
            logger.color('red').bold().log("Empty Contract Name ...");
            return;
        }

        const contractInst = await getContractInst(deployments, "", name, "");
        assert(contractInst, `Unknown contract name ${name}`);

        let oldCount = await contractInst!.additionEventCount();
        logger.color('blue').bold().log("=======Current Addition Event Count========");
        console.log(oldCount.toString());

        let newCount = BigNumber.from((await waitForInput("Enter The New Addition Event Count:")).trim());
        if (!oldCount.eq(newCount)) {
            const tx = await contractInst!.setAdditionEventCount(newCount);
            await tx.wait();
        }

        console.log(`${name} addition event count is ${newCount.toString()}, old value=${oldCount.toString()}`);
    },

    setTokenAddress: async function(deployments: any, deployer: any) {
        const contractInst = await getContractInst(deployments, "", "TokenTransferProxy", "");
        assert(contractInst, `Unknown contract name`);

        let oldTokenAddress = await contractInst!.tokenAddress();
        logger.color('blue').bold().log("=======Current Logic Token Address========");
        console.log(oldTokenAddress);

        let tokenName = (await waitForInput("Enter The New Logic Token Name(e.g. USDT,USDC,TT01,TT02):")).trim();
        if (tokenName.length === 0) {
            console.error(`Empty name`);
            return;
        }

        const checked = ["USDT","USDC","TT01","TT02"].includes(tokenName)
        assert(checked, `Invalid token name ${tokenName}`);
        if (!checked) return;

        const tokenInst = await getContractInst(deployments, "", tokenName, "");
        assert(tokenInst, `Unknown token name ${tokenName}`);

        if (oldTokenAddress !== tokenInst?.address) {
            const tx = await contractInst!.setTokenAddress(tokenInst?.address);
            await tx.wait();
        }

        console.log(`TokenTransferProxy logic token address is ${tokenInst?.address}, old address=${oldTokenAddress}`);
    }
}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts, network } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    let funName = await waitForInput(`Enter The Function Name(e.g. ${Object.keys(FUNC_MAP)}):`);
    funName = funName.trim();
    if (funName.length === 0) {
        logger.color('red').bold().log("Function name is empty");
        return;
    }

    if (!FUNC_MAP[funName]) {
        logger.color('red').bold().log("Function is not defined");
        return;
    }

    await FUNC_MAP[funName](deployments, deployer);
};

export default func;
