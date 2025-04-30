import config from 'config';
import { BigNumber, ethers } from 'ethers';

export class Provider {
    private rpcUrl: string;
    private providerInst: any;

    constructor() {
        this.rpcUrl = config.get("rpc_url");

        this.providerInst = new ethers.providers.JsonRpcProvider(this.rpcUrl);
        this.providerInst.on("error", (error: Error) => {
            console.error("provider error:", error);
        })
    }

    getProviderInst(): any {
        return this.providerInst;
    }

    async getGasPrice(): Promise<BigNumber> {
        return await this.providerInst.getGasPrice();
    }
}
