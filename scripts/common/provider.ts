import config from 'config';
import { error } from 'console';
// const Web3 = require('web3')
import { ethers } from 'ethers';
import { any } from 'hardhat/internal/core/params/argumentTypes';

export class Provider {
    private rpcUrl: string;
    // private web3Inst: any;
    private providerInst: any;

    constructor() {
        this.rpcUrl = config.get("rpc_url");

        // this.web3Inst = new Web3(this.rpcUrl);
        this.providerInst = new ethers.providers.JsonRpcProvider(this.rpcUrl);
        this.providerInst.on("error", (error: Error) => {
            console.error("provider error:", error);
        })
    }

    // getWeb3Inst(): any {
    //     return this.web3Inst;
    // }

    getProviderInst(): any {
        return this.providerInst;
    }
}
