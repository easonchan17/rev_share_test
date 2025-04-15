import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { AccountMgr } from '../common/accountMgr';
import { getContractInst, promptPositiveInteger } from '../common/utils';
import { assert } from 'console';
import { Simulator, ERC20ProxyTransfer } from '../common/simulator';
import { ethers } from 'hardhat';
import logger from 'node-color-log';

interface Operations {
    [key: string]: (deploymens: any, deployer: any) => Promise<void>;
}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts, network } = hre;

    logger.color('blue').log("-----------------------------------------");

    // Init accounts
    logger.color('blue').bold().log("Init Accounts ...");
    const accountMgr = new AccountMgr();
    const accountNum = 2000;
    await accountMgr.initAccounts(accountNum);

    const simulator: Simulator = new Simulator(accountMgr);

    // Proxy inst
    const proxyContractInst = await getContractInst(deployments, "", "TokenTransferProxy", "");
    assert(proxyContractInst);
    if (!proxyContractInst) return;

    const logicToken = await proxyContractInst!.tokenAddress();
    assert(ethers.utils.isAddress(logicToken), `Invalid token address`);
    if (!ethers.utils.isAddress(logicToken)) return;

    // USDT inst
    const usdtInst = await getContractInst(deployments, "", "USDT", "");
    assert(usdtInst);

    // USDC inst
    const usdcInst = await getContractInst(deployments, "", "USDC", "");
    assert(usdcInst);

    // TT1 inst
    const tt01Inst = await getContractInst(deployments, "", "TT01", "");
    assert(tt01Inst);

    // TT2 inst
    const tt02Inst = await getContractInst(deployments, "", "TT02", "");
    assert(tt02Inst);

    const logicTokenMap: Record<string, any> = {};
    logicTokenMap[usdtInst!.address] = usdtInst;
    logicTokenMap[usdcInst!.address] = usdcInst;
    logicTokenMap[tt01Inst!.address] = tt01Inst;
    logicTokenMap[tt02Inst!.address] = tt02Inst;

    const logicTokenInst = logicTokenMap[logicToken];
    const symbol = await logicTokenInst.symbol()

    // Init task
    const simulatorCount = await promptPositiveInteger("Enter The Simulator Count:");
    if (simulatorCount < 0) {
        logger.color('red').bold().log("Invalid simulator count");
        return;
    }

    const requiredSuccessCount = await promptPositiveInteger("Enter The Required Success Count:");
    if (requiredSuccessCount < 0) {
        logger.color('red').bold().log("Invalid required success count");
        return;
    }

    for (let i = 0; i < simulatorCount; i++) {
        simulator.addTask(`proxy_transfer_${symbol}_${i}`, new ERC20ProxyTransfer(proxyContractInst, logicTokenInst, requiredSuccessCount));
    }

    await simulator.start();
};

export default func;
