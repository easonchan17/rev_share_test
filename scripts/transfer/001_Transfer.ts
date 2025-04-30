import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { AccountMgr } from '../common/accountMgr';
import { getContractInst, promptPositiveInteger, waitForInput } from '../common/utils';
import { assert } from 'console';
import { Simulator, ERC20Transfer, NativeTokenTransfer } from '../common/simulator';
import logger from 'node-color-log';
import { Configuration } from '../common/configuration';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts, network } = hre;

    logger.color('blue').log("-----------------------------------------");

    const symbol = await waitForInput("Enter The Token Symbol(e.g. USDT,USDC,TT01,TT02,NATIVE):");
    if (symbol.length === 0) {
        logger.color('red').bold().log("Invalid symbol");
        return;
    }

    const simulatorCount = await promptPositiveInteger("Enter The Simulator Count:");
    if (simulatorCount < 0) {
        logger.color('red').bold().log("Invalid simulator count");
        return;
    }

    const requiredSuccessCount = await promptPositiveInteger("Enter The Required Success Count(e.g. 0~N):");
    if (requiredSuccessCount < 0) {
        logger.color('red').bold().log("Invalid required success count");
        return;
    }

    const txType = await promptPositiveInteger("Enter The Tx Type(e.g. 0:legacy, 2:dynamicFee, others: unsupported):");
    const accountMgr = new AccountMgr();
    if (!accountMgr.initDefaultTxType(txType)) {
        logger.color('red').bold().log("Invalid tx type");
        return;
    }

    // Init accounts
    logger.color('blue').bold().log("Init Accounts ...");
    const accountNum = 2000;
    await accountMgr.initAccounts(accountNum);

    const simulator: Simulator = new Simulator(accountMgr);
    // Init task
    if (symbol === 'NATIVE') {
        for (let i = 0; i < simulatorCount; i++) {
            simulator.addTask(`transfer_${symbol}_${i}`, new NativeTokenTransfer(requiredSuccessCount));
        }
    } else {
        const contractInst = await getContractInst(deployments, "", symbol, "");
        assert(contractInst, `Invalid symbol ${symbol}`);
        if (!contractInst) return;

        for (let i = 0; i < simulatorCount; i++) {
            simulator.addTask(`transfer_${symbol}_${i}`, new ERC20Transfer(contractInst, requiredSuccessCount));
        }

        const feeConfig = new Configuration();
        const transferEvent = await feeConfig.getRevShareList(contractInst, "Transfer");
        simulator.listenEvents([transferEvent]);
    }

    await simulator.start();
};

export default func;
