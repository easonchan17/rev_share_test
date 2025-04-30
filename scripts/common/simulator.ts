import { Account, AccountMgr, TransferResult } from "./accountMgr";
import { assert } from "console";
import { BigNumber } from "ethers";
import { EventEmitter } from "stream";
import * as readline from 'readline';
import chalk from 'chalk';
import { ethers } from "hardhat";
import { sleep } from "./utils";

export class Transfer {
    readonly MIN_BALANCE: BigNumber = BigNumber.from(10).pow(18);
    readonly SPONSOR_AMOUNT_PER_TIME: BigNumber = BigNumber.from(10).pow(20);
    readonly MIN_TRANSFER_AMOUNT: BigNumber = BigNumber.from(1e5);

    name: string;
    accountMgr: any;
    isRunning: boolean;
    eventEmitter: EventEmitter;

    successedCount: number = 0;
    failedCount: number = 0;
    totalCount: number = 0;
    requiredSuccessedCount: number = 0;

    constructor() {
        this.name = this.constructor.name;
        this.isRunning = false;
        this.eventEmitter = new EventEmitter();
        this.eventEmitter.on('stop', () => {
            if (!this.isRunning) {
                console.log(chalk.yellow(`${this.name} is not running`));
                return;
            }

            this.isRunning = false;
            console.log(chalk.yellow(`Stopping ${this.name}`));
        })
    }

    getName(): string {
        return this.name;
    }

    setName(name: string) {
        this.name = name;
    }

    setAccountMgr(accountMgr: AccountMgr) {
        assert(accountMgr);
        this.accountMgr = accountMgr;
    }

    status(): [boolean, number] {
        const successRate = (this.successedCount/this.totalCount*100).toFixed(2);
        const failedRate = (this.failedCount/this.totalCount*100).toFixed(2);
        const collisionRate = ((this.totalCount-this.successedCount-this.failedCount)/this.totalCount*100).toFixed(2);
        console.log(chalk.yellow(
            `${this.name} ${this.isRunning ? 'is running' : 'is not running'}, ` +
            `total:${this.totalCount}, successed:${this.successedCount}, failed:${this.failedCount}, ` +
            `success rate:${successRate}%, ` +
            `failed rate:${failedRate}%, ` +
            `nonce collision rate:${collisionRate}%`
        ));

        return [this.isRunning, this.successedCount];
    }

    stop() {
        this.eventEmitter.emit('stop');
    }

    async start() {
        if (this.isRunning) {
            console.log(chalk.yellow(`${this.name} already running`));
            return;
        }

        console.log(chalk.yellow(`${this.name} started`));
        this.isRunning = true;

        await this.internalLoop();

        this.isRunning = false;
        console.log(chalk.yellow(`${this.name} stopped`));
    }

    async internalLoop() {

    }

    isQuit(): boolean {
        return !(this.isRunning && (this.requiredSuccessedCount == 0 || this.requiredSuccessedCount > this.successedCount));
    }

    async sponsorGas(receiver: Account, amount: BigNumber): Promise<TransferResult> {
        let ret: TransferResult = TransferResult.Failed;

        while (!this.isQuit() && ret !== TransferResult.Success) {
            ret = await this.accountMgr.sponsorToAccount(receiver, amount);

            if (ret !== TransferResult.Success) {
                await sleep(3000);
                continue;
            }

            console.log(chalk.blue(`Sponsored ${amount.toString()} GAS to ${receiver.address}`));
        }

        return ret;
    }

    async sponsorERC20(contract: any, receiver: Account, amount: BigNumber): Promise<TransferResult> {
        let ret: TransferResult = TransferResult.Failed;
        while (!this.isQuit() && ret !== TransferResult.Success) {
            ret = await this.accountMgr.sponsorERC20ToAccount(contract, receiver, amount);

            if (ret !== TransferResult.Success) {
                await sleep(3000);
                continue;
            }

            const symbol = await this.accountMgr.getERC20Symbol(contract);
            console.log(chalk.blue(`Sponsored ${amount.toString()} ${symbol} to ${receiver.address}`));
        }

        return ret;
    }

    async transferGasFrom(sender: Account, receiver: Account, amount: BigNumber): Promise<TransferResult> {
        let ret: TransferResult = TransferResult.Failed;

        while (!this.isQuit() && ret !== TransferResult.Success) {
            ret = await this.accountMgr.transfer(sender, receiver, amount);

            if (ret !== TransferResult.Success) {
                await sleep(3000);
            }
        }

        switch (ret) {
            case TransferResult.Success:
                console.log(chalk.blue(`Transfer ${amount.toString()} GAS from ${sender.address} to ${receiver.address} success`));
                break;
            case TransferResult.Failed:
                console.log(chalk.red(`Transfer ${amount.toString()} GAS from ${sender.address} to ${receiver.address} failed`));
                break;
            case TransferResult.NonceBlocked:
                break;
            default:
                console.error(`Unknow result ${ret}`);
                break;
        }

        return ret;
    }

    async transferERC20From(contract: any, sender: Account, receiver: Account, amount: BigNumber): Promise<TransferResult> {
        let ret: TransferResult = TransferResult.Failed

        while (!this.isQuit() && ret !== TransferResult.Success) {
            ret = await this.accountMgr.transforERC20(contract, sender, receiver, amount);
            if (ret != TransferResult.Success) {
                await sleep(3000);
            }
        }

        const symbol = await this.accountMgr.getERC20Symbol(contract);

        switch (ret) {
            case TransferResult.Success:
                console.log(chalk.blue(`Transfer ${amount.toString()} ${symbol} from ${sender.address} to ${receiver.address} success`));
                break;
            case TransferResult.Failed:
                console.log(chalk.red(`Transfer ${amount.toString()} ${symbol} from ${sender.address} to ${receiver.address} failed`));
                break;
            case TransferResult.NonceBlocked:
                break;
            default:
                console.error(`Unknow result ${ret}`);
                break;
        }

        return ret;
    }
}

export class SponsorNativeToken extends Transfer {
    startId: number;
    stopId: number;
    sponsor: Account;
    requiredAmount: BigNumber;

    constructor(startId: number, stopId: number, requiredAmount: BigNumber) {
        super()

        assert(requiredAmount.gte(this.MIN_BALANCE))
        this.startId = startId;
        this.stopId = stopId;
        this.requiredAmount = requiredAmount;
        console.log(`SponsorNativeToken id from ${startId} to ${stopId}`);

        const wallet = ethers.Wallet.createRandom();
        this.sponsor = {
            address: wallet.address,
            privateKey: wallet.privateKey
        };

        console.log(`Sponsor address=${wallet.address}, privateKey:${wallet.privateKey}`);
        assert(this.stopId > this.startId);
    }

    override async internalLoop() {
        const accounts: Record<string, Account> = this.accountMgr.getAccounts();
        const accountList: Account[] = Object.values(accounts);
        this.stopId = Math.min(this.stopId, accountList.length-1);
        if (this.stopId < this.startId) return;

        // Check gas
        const requiredGas = BigNumber.from(10).mul(this.MIN_BALANCE);
        const requiredAmount = BigNumber.from(this.stopId - this.startId + 1).mul(this.requiredAmount).add(requiredGas);

        let balance = await this.accountMgr.getBalance(this.sponsor);
        if (balance.lt(requiredAmount)) {
            const amount = requiredAmount.sub(balance);
            await this.sponsorGas(this.sponsor, amount);
        }

        let curId: number = this.startId;
        while(!this.isQuit() && curId <= this.stopId) {
            const account = accountList[curId];
            curId++;

            let balance = await this.accountMgr.getBalance(account);
            if (balance.gte(this.requiredAmount)) continue;

            this.totalCount++;

            const ret = await this.transferGasFrom(this.sponsor, account, this.requiredAmount);

            switch (ret) {
                case TransferResult.Success:
                    this.successedCount++;
                    break;
                case TransferResult.Failed:
                    this.failedCount++;
                    break;
                case TransferResult.NonceBlocked:
                    break;
                default:
                    console.error(`Unknow result ${ret}`);
                    break;
            }
        }

        // Refund balance
        balance = await this.accountMgr.getBalance(this.sponsor);
        if (balance.lte(this.MIN_BALANCE)) return;

        const deployer = this.accountMgr.getDeployer();
        const ret = await this.transferGasFrom(this.sponsor, deployer, balance.sub(this.MIN_BALANCE));
        if (ret === TransferResult.Success) {
            const balance = await this.accountMgr.getBalance(this.sponsor);
            console.log(chalk.blue(`Refunded GAS success, ${this.sponsor.address} current balance = ${balance.toString()}`));
        }
    }
}

export class SporsorERC20Token extends Transfer {
    contract: any;
    startId: number;
    stopId: number;
    sponsor: Account;
    requiredAmount: BigNumber;

    constructor(contractInst: any, startId: number, stopId: number, requiredAmount: BigNumber) {
        super()
        assert(requiredAmount.gte(this.MIN_BALANCE));
        this.contract = contractInst;
        this.startId = startId;
        this.stopId = stopId;
        this.requiredAmount = requiredAmount;
        console.log(`SporsorERC20Token id from ${startId} to ${stopId}`);

        const wallet = ethers.Wallet.createRandom();
        this.sponsor = {
            address: wallet.address,
            privateKey: wallet.privateKey
        };

        console.log(`Sponsor address=${wallet.address}, privateKey:${wallet.privateKey}`);
        assert(this.stopId > this.startId);
    }

    override async internalLoop() {
        assert(this.contract);

        const accounts: Record<string, Account> = this.accountMgr.getAccounts();
        const accountList: Account[] = Object.values(accounts);
        this.stopId = Math.min(this.stopId, accountList.length-1);
        if (this.stopId < this.startId) return;

        // Sponsor gas
        const requiredGas = BigNumber.from(10).mul(this.MIN_BALANCE);
        let balance = await this.accountMgr.getBalance(this.sponsor);
        if (balance.lt(requiredGas)) {
            await this.sponsorGas(this.sponsor, requiredGas.sub(balance));
        }

        // Sponsor erc20
        const requiredERC20 = BigNumber.from(this.stopId - this.startId + 1).mul(this.requiredAmount);
        let erc20Balance = await this.accountMgr.getERC20Balance(this.contract, this.sponsor);
        if (erc20Balance.lt(requiredERC20)) {
            await this.sponsorERC20(this.contract, this.sponsor, requiredERC20.sub(erc20Balance));
        }

        // Sponsor tasks
        let curId: number = this.startId;

        while(!this.isQuit() && curId <= this.stopId) {
            const account = accountList[curId];
            curId++;

            const erc20Balance = await this.accountMgr.getERC20Balance(this.contract, account);
            if (erc20Balance.gte(this.requiredAmount)) continue;

            this.totalCount++;

            const amount = this.requiredAmount.sub(erc20Balance);
            const ret = await this.transferERC20From(this.contract, this.sponsor, account, amount);

            switch (ret) {
                case TransferResult.Success:
                    this.successedCount++;
                    break;
                case TransferResult.Failed:
                    this.failedCount++;
                    break;
                case TransferResult.NonceBlocked:
                    break;
                default:
                    console.error(`Unknow result ${ret}`);
                    break;
            }
        }

        const deployer = this.accountMgr.getDeployer();

        // Refund erc20
        erc20Balance = await this.accountMgr.getERC20Balance(this.contract, this.sponsor);
        if (erc20Balance.gt(0)) {
            const ret = await this.transferERC20From(this.contract, this.sponsor, deployer, erc20Balance);
            if (ret === TransferResult.Success) {
                const symbol = await this.accountMgr.getERC20Symbol(this.contract);
                const erc20Balance = await this.accountMgr.getERC20Balance(this.contract, this.sponsor);
                console.log(chalk.blue(`Refunded ${symbol} success, ${this.sponsor.address} current balance = ${erc20Balance.toString()}`));
            }
        }

        // Refund gas
        balance = await this.accountMgr.getBalance(this.sponsor);
        if (balance.gt(this.MIN_BALANCE)) {
            const ret = await this.transferGasFrom(this.sponsor, deployer, balance.sub(this.MIN_BALANCE));
            if (ret === TransferResult.Success) {
                const balance = await this.accountMgr.getBalance(this.sponsor);
                console.log(chalk.blue(`Refunded GAS success, ${this.sponsor.address} current balance = ${balance.toString()}`));
            }
        }
    }
}

export class NativeTokenTransfer extends Transfer  {
    constructor(requiredSuccessedCount: number) {
        super();
        this.requiredSuccessedCount = requiredSuccessedCount;
    }

    override async internalLoop() {
        while(!this.isQuit()) {
            const accountPair = this.accountMgr.chooseAccountPair();
            if (accountPair.length == 0) {
                console.log(chalk.red('Choose 2 same accounts'));
                continue;
            }

            this.totalCount++;

            // Check balance
            const balance = await this.accountMgr.getBalance(accountPair[0]);
            if (balance.lt(this.MIN_BALANCE)) {
                await this.sponsorGas(accountPair[0], this.SPONSOR_AMOUNT_PER_TIME);
            }

            await this.processTask(accountPair[0], accountPair[1], this.MIN_TRANSFER_AMOUNT);
        }
    }

    private async processTask(from: Account, to: Account, amount: BigNumber) {
        const ret = await this.transferGasFrom(from, to, amount);

        switch (ret) {
            case TransferResult.Success:
                this.successedCount++;
                break;
            case TransferResult.Failed:
                this.failedCount++;
                break;
            case TransferResult.NonceBlocked:
                break;
            default:
                console.error(`Unknow result ${ret}`);
                break;
        }
    }


}

export class ERC20Transfer extends Transfer {
    contract: any;

    constructor(contractInst: any, requiredSuccessedCount: number) {
        super();
        this.contract = contractInst;
        this.requiredSuccessedCount = requiredSuccessedCount;
    }

    override async internalLoop() {
        assert(this.contract);

        while(!this.isQuit()) {
            const accountPair = this.accountMgr.chooseAccountPair();
            if (accountPair.length == 0) {
                console.log(chalk.red('Choose 2 same accounts'));
                continue;
            }

            this.totalCount++;
            // Check gas
            const balance = await this.accountMgr.getBalance(accountPair[0]);
            if (balance.lt(this.MIN_BALANCE)) {
                await this.sponsorGas(accountPair[0], this.SPONSOR_AMOUNT_PER_TIME)
            }

            // Check erc20
            const erc20Balance = await this.accountMgr.getERC20Balance(this.contract, accountPair[0]);
            if (erc20Balance.lt(this.MIN_BALANCE)) {
                await this.sponsorERC20(this.contract, accountPair[0], this.SPONSOR_AMOUNT_PER_TIME);
            }

            await this.processTask(accountPair[0], accountPair[1], this.MIN_TRANSFER_AMOUNT);
        }
    }

    private async processTask(from: Account, to: Account, amount: BigNumber) {
        const ret = await this.transferERC20From(this.contract, from, to, amount);

        switch (ret) {
            case TransferResult.Success:
                this.successedCount++;
                break;
            case TransferResult.Failed:
                this.failedCount++;
                break;
            case TransferResult.NonceBlocked:
                break;
            default:
                console.error(`Unknow result ${ret}`);
                break;
        }
    }
}

export class ERC20ProxyTransfer extends Transfer {
    proxyContract: any;
    logicContract: any;

    constructor(proxyContractInst: any, logicContractInst: any, requiredSuccessedCount: number) {
        super();
        this.proxyContract = proxyContractInst;
        this.logicContract = logicContractInst;
        this.requiredSuccessedCount = requiredSuccessedCount;
    }

    override async internalLoop() {
        assert(this.logicContract);

        while(!this.isQuit()) {
            const accountPair = this.accountMgr.chooseAccountPair();
            if (accountPair.length == 0) {
                console.log(chalk.red('Choose 2 same accounts'));
                continue;
            }

            this.totalCount++;

            // Check gas
            const balance = await this.accountMgr.getBalance(accountPair[0]);
            if (balance.lt(this.MIN_BALANCE)) {
                await this.sponsorGas(accountPair[0], this.SPONSOR_AMOUNT_PER_TIME);
            }

            // Check erc20
            const symbol = await this.accountMgr.getERC20Symbol(this.logicContract);
            const erc20Balance = await this.accountMgr.getERC20Balance(this.logicContract, accountPair[0]);
            if (erc20Balance.lt(this.MIN_BALANCE)) {
                await this.sponsorERC20(this.logicContract, accountPair[0], this.SPONSOR_AMOUNT_PER_TIME);
            }

            await this.processTask(accountPair[0], accountPair[1], symbol, this.MIN_TRANSFER_AMOUNT);
        }
    }

    private async processTask(from: Account, to: Account, symbol: string, amount: BigNumber) {
        let ret: TransferResult = TransferResult.Failed;

        while (!this.isQuit() && ret !== TransferResult.Success) {
            ret = await this.accountMgr.proxyTransforERC20(
                this.proxyContract,
                this.logicContract,
                from,
                to,
                amount
            );

            if (ret != TransferResult.Success) {
                await sleep(3000);
            }
        }


        switch (ret) {
            case TransferResult.Success:
                console.log(chalk.blue(`Proxy Transfer ${amount.toString()} ${symbol} from ${from.address} to ${to.address} success`));
                this.successedCount++;
                break;
            case TransferResult.Failed:
                console.log(chalk.red(`Proxy Transfer ${amount.toString()} ${symbol} from ${from.address} to ${to.address} failed`));
                this.failedCount++;
                break;
            case TransferResult.NonceBlocked:
                break;
            default:
                console.error(`Unknow result ${ret}`);
                break;
        }
    }
}


export class Simulator {
    accountMgr: AccountMgr;
    tasks: Record<string, Transfer> = {};

    balances: Record<string, BigNumber> = {}
    gasPerTx: Record<string, BigNumber> = {}

    constructor(accountMgr: AccountMgr) {
        this.accountMgr = accountMgr;
    }

    addTask(name: string, task: Transfer) {
        task.setName(name);
        task.setAccountMgr(this.accountMgr);

        this.tasks[name] = task;
    }

    async listenEvents(events: any) {
        if (!events || events.length === 0) return;

        const gasPrice = await this.accountMgr.getGasPrice();

        for (const event of events) {
            const gas = BigNumber.from(event.gas)
            for (const reward of event.rewards) {
                this.balances[reward.rewardAddr] = await this.accountMgr.getBalance(reward.rewardAddr);

                const oldVal = this.gasPerTx[reward.rewardAddr] ?? BigNumber.from(0);
                this.gasPerTx[reward.rewardAddr] = gas.mul(reward.rewardPercentage).div(10000).mul(gasPrice).add(oldVal);
            }
        }
    }

    async start() {
        // const originalSend = JsonRpcProvider.prototype.send;

        // JsonRpcProvider.prototype.send = async function (method, params) {
        //     try {
        //         return await originalSend.call(this, method, params);
        //     } catch (err) {
        //         console.error(`RPC Error calling ${method} with params ${JSON.stringify(params)}`);
        //         const errorMessage = err instanceof Error ? err.message: JSON.stringify(err);
        //         console.error("Original Error:", errorMessage);
        //     }
        // };


        this.startAll();

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        })

        await new Promise<void>((resolve) => {
            rl.on('line', (input) => {
                const command = input.trim();

                if (command === 'exit') {
                    rl.close();
                    resolve();
                    return;
                }

                if (command === 'start all') {
                    this.startAll();
                    return;
                }

                if (command === 'stop all') {
                    this.stopAll();
                    return;
                }

                if (command === 'show status') {
                    this.showStatus();
                    return;
                }

                const match = command.match(/^(start|stop)\s+(\w+)$/);
                if (!match) {
                    console.error(`Invalid command`);
                    return;
                }

                const [_, action, taskName] = match;
                console.log(action, taskName)
                action === 'start' ? this.startTask(taskName) : this.stopTask(taskName);
            });
        })
    }

    private startTask(name: string) {
        const task = this.tasks[name];
        if (!task) return;

        task.start();
    }

    private stopTask(name: string) {
        const task = this.tasks[name];
        if (!task) return;

        task.stop();
    }

    private startAll() {
        for (const task of Object.values(this.tasks)) {
            task.start();
        }
    }

    private stopAll() {
        for (const task of Object.values(this.tasks)) {
            task.stop();
        }
    }

    private async showStatus() {
        let runningTaskCount = 0;
        let totalSuccessedCount = 0;
        for (const task of Object.values(this.tasks)) {
            const [isRunning, successedCount] = task.status();
            if (isRunning) {
                runningTaskCount++;
            }
            totalSuccessedCount += successedCount;
        }
        console.log(chalk.blue(`There are ${runningTaskCount} tasks is Running`));

        if (runningTaskCount > 0) return;

        for (const [addr, val] of Object.entries(this.gasPerTx)) {
            const oldBalance = this.balances[addr];
            const newBalance = await this.accountMgr.getBalance(addr);
            const expectedAddBalance = this.gasPerTx[addr].mul(totalSuccessedCount);
            const actualAddAmount = newBalance.sub(oldBalance);
            console.log(chalk.blue(`Revenue sharing: address=${addr}, expected added amount=${expectedAddBalance}, actual added amount=${actualAddAmount}, is equal=${expectedAddBalance.eq(actualAddAmount)}`));
        }
    }
}
