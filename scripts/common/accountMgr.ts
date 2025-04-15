import { assert } from "console";
import { BigNumber, ethers } from "ethers";
import { Provider } from "./provider";
import { Mutex } from 'async-mutex';
import { randomInt } from 'crypto';
import { createDirIfNotExist, ExecutionErrorMatcher, sleep, waitForInput } from "./utils";
import fs from "fs";

export interface Account {
    address: string;
    privateKey: string;
};

export enum TransferResult {
    Success,
    Failed,
    NonceBlocked,
};

export class AccountMgr {
    readonly jsonFile: string = `db/${process.env.NETWORK}/accounts.json`;

    private accounts: Record<string, Account> = {};
    private contracts: Record<string, any> = {};
    private deployer: Account|null = null;
    private nonces: Record<string, number> = {}

    private providerInst: any;

    private nonceMutexes: Record<string, Mutex> = {};

    constructor() {
        this.providerInst = new Provider().getProviderInst();
        this.initDeployer();
    }

    async getBalance(
        account: Account|string
    ): Promise<BigNumber> {
        if (typeof account !== 'string') {
            account = account.address;
        }

        // while(true) {
        //     const matcher = new ExecutionErrorMatcher();
        //     try {
        return await this.providerInst.getBalance(account);
        //     } catch (error) {
        //         matcher.filter("getBalance", error);
        //     }

        //     await sleep(2000)
        // }
    }

    async getERC20Balance(
        contract: any,
        account: Account|string
    ): Promise<BigNumber> {
        if (typeof account !== 'string') {
            account = account.address;
        }

        // while(true) {
        //     const matcher = new ExecutionErrorMatcher();
        //     try {
        return await contract.balanceOf(account);
        //     } catch(error) {
        //         matcher.filter("balanceOf", error);
        //     }

        //     await sleep(2000)
        // }
    }


    getDeployer(): Account|null {
        return this.deployer;
    }

    getAccounts(): Record<string, Account> {
        return this.accounts;
    }

    chooseAccountPair(): Account[] {
        const accountPair: Account[] = [];

        const keys = Object.keys(this.accounts);
        assert(keys.length > 1);

        const index1 = randomInt(keys.length);
        const index2 = randomInt(keys.length);
        if (index1 === index2) return accountPair;

        accountPair.push(this.accounts[keys[index1]]);
        accountPair.push(this.accounts[keys[index2]]);

        return accountPair;
    }

    chooseAccount(): Account {
        const keys = Object.keys(this.accounts);
        assert(keys.length > 0);

        const index = randomInt(keys.length);

        return this.accounts[keys[index]];
    }

    async initAccounts(count: number): Promise<boolean> {
        this.accounts = this.loadAccounts();
        if (Object.keys(this.accounts).length == count) return true;
        assert(Object.keys(this.accounts).length == count);

        let answer = await waitForInput(`Generate ${count} new accounts now?(y or n):`);
        answer = answer.trim();
        if (answer !== 'y') return false;

        this.accounts = this.generateAccounts(count);
        return Object.keys(this.accounts).length == count && this.saveAccounts();
    }

    addContract(name: string, contractInst: any) {
        this.contracts[name] = contractInst;
    }

    async sponsorToAccount(
        account: Account,
        amount: BigNumber
    ): Promise<TransferResult> {
        await this.waitUntilSufficientBalance(this.deployer!, amount);
        return await this.transfer(this.deployer!, account, amount);
    }

    async sponsorToAccountFrom(
        sponsor: Account,
        account: Account,
        amount: BigNumber
    ): Promise<TransferResult> {
        await this.waitUntilSufficientBalance(sponsor, amount);
        return await this.transfer(sponsor, account, amount);
    }

    async sponsorERC20ToAccount(
        contract: any,
        account: Account,
        amount: BigNumber
    ): Promise<TransferResult> {
        await this.waitUntilSufficientERC20Balance(contract, this.deployer!, amount);
        return await this.transforERC20(contract, this.deployer!, account, amount);
    }

    async sponsorERC20ToAccountFrom(
        contract: any,
        sponsor: Account,
        account: Account,
        amount: BigNumber
    ): Promise<TransferResult> {
        await this.waitUntilSufficientERC20Balance(contract, sponsor, amount);
        return await this.transforERC20(contract, sponsor, account, amount);
    }

    async transfer(
        from: Account,
        to: Account,
        amount: BigNumber
    ): Promise<TransferResult> {
        if (!await this.lockNonce(from)) {
            return TransferResult.NonceBlocked;
        }

        const matcher = new ExecutionErrorMatcher();
        let ret: TransferResult = TransferResult.Failed;
        try {
            const wallet = new ethers.Wallet(from.privateKey, this.providerInst);
            const tx = await wallet.sendTransaction({
                to: to.address,
                value: amount
            });

            await tx.wait();
            ret = TransferResult.Success;
        } catch(error) {
            matcher.filter("transfer", error);
        }

        this.unlockNonce(from);

        return ret;
    }

    async transforERC20(
        contract: any,
        from: Account,
        to: Account,
        amount: BigNumber
    ): Promise<TransferResult> {
        if (!await this.lockNonce(from)) {
            return TransferResult.NonceBlocked;
        }

        const matcher = new ExecutionErrorMatcher();
        let ret: TransferResult = TransferResult.Failed;
        try {
            const newSigner = new ethers.Wallet(from.privateKey, this.providerInst);
            contract = contract.connect(newSigner);

            // console.log(`Before transfer from ${from.address} to ${to.address}`);
            const tx = await contract.transfer(
                to.address,
                amount
            );

            await tx.wait();
            ret = TransferResult.Success;
        } catch (error) {
            matcher.filter("transforERC20", error);
        }

        this.unlockNonce(from);

        return ret;
    }

    async proxyTransforERC20(
        proxyContract: any,
        logicContract: any,
        from: Account,
        to: Account,
        amount: BigNumber
    ): Promise<TransferResult> {
        if (!await this.lockNonce(from)) {
            return TransferResult.NonceBlocked;
        }

        const matcher = new ExecutionErrorMatcher();
        const newSigner = new ethers.Wallet(from.privateKey, this.providerInst);
        let ret: TransferResult = TransferResult.Failed;
        try {
            logicContract = logicContract.connect(newSigner);

            const approveTx = await logicContract.approve(
                proxyContract.address,
                amount
            );

            await approveTx.wait();
            ret = TransferResult.Success;
        } catch (error) {
            matcher.filter("proxyTransforERC20_1", error);
        }
        this.unlockNonce(from);

        if (ret === TransferResult.Failed) return ret;


        if (!await this.lockNonce(from)) {
            return TransferResult.NonceBlocked;
        }

        matcher.update();
        ret = TransferResult.Failed;
        try {
            proxyContract = proxyContract.connect(newSigner);
            const proxyTx = await proxyContract.proxyTransfer(
                to.address,
                amount
            );

            await proxyTx.wait();
            ret = TransferResult.Success;
        } catch (error) {
            matcher.filter("proxyTransforERC20_2", error);
        }

        this.unlockNonce(from);

        return ret;
    }

    async waitUntilSufficientBalance(
        account: Account,
        required: BigNumber
    ): Promise<void> {
        return new Promise((resolve) => {
            const check = async () => {
                const balance = await this.getBalance(account);
                if (balance.gte(required)) {
                    this.providerInst.off("block", check);
                    resolve();
                } else {
                    console.log(`Insufficient balance (${ethers.utils.formatEther(balance)} CORE). Waiting for depositing to ${account.address} ...`);
                }
            };

            this.providerInst.on("block", check);
        });
    }

    async getERC20Symbol(contract: any): Promise<string> {
        const matcher = new ExecutionErrorMatcher();
        try {
            return await contract.symbol();
        } catch (error) {
            matcher.filter("getERC20Symbol", error);
        }

        return "";
    }

    async waitUntilSufficientERC20Balance(
        contract: any,
        account: Account,
        required: BigNumber
    ): Promise<void> {
        return new Promise((resolve) => {
            const check = async () => {
                const balance = await this.getERC20Balance(contract, account);
                if (balance.gte(required)) {
                    this.providerInst.off("block", check);
                    resolve();
                } else {
                    const symbol = await this.getERC20Symbol(contract);
                    console.log(`Insufficient balance (${ethers.utils.formatEther(balance)} ${symbol}). Waiting for depositing to ${account.address} ...`);
                }
            };

            this.providerInst.on("block", check);
        });
    }

    generateAccounts(count: number): Record<string, Account> {
        const accounts: Record<string, Account> = {}

        for (let i = 0; i < count; i++) {
            const wallet = ethers.Wallet.createRandom();
            accounts[wallet.address] = {
                address: wallet.address,
                privateKey: wallet.privateKey
            };
        }

        console.log(`Generate ${count} new accounts`);

        return accounts;
    }

    private initDeployer() {
        const privateKey = process.env.PRIVATE_KEY;
        assert(privateKey, `Invalid privatekey`);

        const wallet = new ethers.Wallet(privateKey!);
        this.deployer = {
            address: wallet.address,
            privateKey: privateKey!
        };
    }

    private loadAccounts(): Record<string, Account> {
        let accounts : Record<string, Account> = {};

        try {
            const ok = createDirIfNotExist(this.jsonFile);
            assert(ok);

            if (fs.existsSync(this.jsonFile)) {
                let content = fs.readFileSync(this.jsonFile, "utf-8");
                accounts = JSON.parse(content.trim()) as Record<string, Account>;

                console.log(`Load ${Object.keys(accounts).length} accounts from file`);
            }
        } catch (error) {
            console.error(error);
        }

        return accounts;
    }

    private saveAccounts(): boolean {
        const count = Object.keys(this.accounts).length
        assert(count > 0, `Invalid accounts`);

        if (count == 0) return false;

        let ok = false;

        try {
            fs.writeFileSync(this.jsonFile, JSON.stringify(this.accounts, null, 2));
            console.log(`Save ${count} accounts to file`);
            ok = true;
        } catch(error) {
            console.error(error);
        }

        return ok;
    }

    private getMutex(account: Account): Mutex {
        if (!this.nonceMutexes[account.address]) {
            this.nonceMutexes[account.address] = new Mutex();
        }

        return this.nonceMutexes[account.address];
    }

    private async lockNonce(account: Account): Promise<boolean> {
        // Allow undefined
        // If greater than or equal to 0(is valid nonce value), it indicates that there are pending transactions.
        if (this.nonces[account.address] >= 0) {
            return false;
        }

        const mutex = this.getMutex(account);
        return await mutex.runExclusive(async () => {
            const matcher = new ExecutionErrorMatcher();
            try {
                const nonce = await this.providerInst.getTransactionCount(account.address, "pending");
                if (this.nonces[account.address] === nonce) {
                    // console.log(`Locked nonce=${this.nonces[account.address]}, account=${account.address}`);
                    return false;
                }

                this.nonces[account.address] = nonce;
                return true;
            } catch(error) {
                matcher.filter("lockerNonce", error);
            }
            return false
        })
    }

    private unlockNonce(account: Account) {
        // const mutex = this.getMutex(account);
        // return await mutex.runExclusive(async () => {
        //     this.nonces[account.address] = -1;
        //     return true;
        // })
        this.nonces[account.address] = -1;
    }
}