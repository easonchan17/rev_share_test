import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { AccountMgr } from '../common/accountMgr';
import { getContractInst, waitForInput,promptPositiveInteger } from '../common/utils';
import { assert } from 'console';
import { Simulator, SponsorNativeToken, SporsorERC20Token } from '../common/simulator';
import { BigNumber } from 'ethers';
import logger from 'node-color-log';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts, network } = hre;
    logger.color('blue').log("-----------------------------------------");

    const symbol = await waitForInput("Enter The Token Symbol(e.g. USDT,USDC,TT01,TT02,NATIVE):");
    if (symbol.length === 0) {
        logger.color('red').bold().log("Symbol is empty");
        return;
    }

    const simulatorCount = await promptPositiveInteger("Enter The Simulator Count(e.g. 40):");
    if (simulatorCount < 0) {
        logger.color('red').bold().log("Invalid simulator count");
        return;
    }

    // Init accounts
    logger.color('blue').bold().log("Init Accounts ...");
    const accountCount = 2000;
    const accountMgr = new AccountMgr();
    await accountMgr.initAccounts(accountCount);


    const simulator: Simulator = new Simulator(accountMgr);
    const beneficiaryCount = accountCount / simulatorCount;
    const requiredAmount = BigNumber.from(10).pow(21);

    // Init task
    if (symbol === 'NATIVE') {
        for (let i = 0; i < simulatorCount; i++) {
            const startId = i * beneficiaryCount;
            const stopId = startId + beneficiaryCount - 1;
            simulator.addTask(`sponsor_${symbol}_${i}`, new SponsorNativeToken(startId, stopId, requiredAmount));
        }
    } else {
        const contractInst = await getContractInst(deployments, "", symbol, "");
        assert(contractInst, `Invalid symbol ${symbol}`);
        if (!contractInst) return;

        for (let i = 0; i < simulatorCount; i++) {
            const startId = i * beneficiaryCount;
            const stopId = startId + beneficiaryCount - 1;
            simulator.addTask(`sponsor_${symbol}_${i}`, new SporsorERC20Token(contractInst, startId, stopId, requiredAmount));
        }
    }

    await simulator.start();
};

export default func;
