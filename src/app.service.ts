import { Injectable } from '@nestjs/common';
import { Alchemy, AssetTransfersCategory, AssetTransfersResult, BigNumber, Network, Utils } from 'alchemy-sdk';

@Injectable()
export class AppService {
  private readonly ALCHEMY_APIKEY = process.env.ALCHEMY_API_KEY;
  private readonly BAYC_CONTRACT_ADDRESS = process.env.BAYC_CONTRACT_ADDRESS;

  isExact: boolean = false;

  private readonly alchemy: Alchemy;

  constructor() {
    this.alchemy = new Alchemy({
      apiKey: this.ALCHEMY_APIKEY,
      network: Network.ETH_MAINNET
    });
  }

  async run() {
    const epochTime = await this.getEpochTimeInput();
    console.log(`get ETH value for epoch time: ${epochTime}`);
    console.log('please wait');
    await this.getETHBalancesByEpochTime(epochTime);
  }

  async getEpochTimeInput(): Promise<number> {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const query: string = 'Enter epoch time: ';
    return new Promise((resolve) => {
      rl.question(query, (answer: string) => {
        const epochTime = parseInt(answer, 10);
        resolve(epochTime);
      });
    });
  }

  async getHoldersByBlockRange(blockNumber: string): Promise<AssetTransfersResult[]> {
    try {
      const assetTransfers = await this.alchemy.core.getAssetTransfers({
        fromBlock: blockNumber,
        toBlock: blockNumber,
        category: [
          AssetTransfersCategory.ERC721, 
          AssetTransfersCategory.ERC20,
          AssetTransfersCategory.EXTERNAL,
          AssetTransfersCategory.INTERNAL,
          AssetTransfersCategory.ERC1155,
          AssetTransfersCategory.SPECIALNFT
        ],
        contractAddresses: [this.BAYC_CONTRACT_ADDRESS],
      });
  
      return assetTransfers.transfers; 
    } catch (error) {
      console.error(`Failed to get holders`, error);
      throw error;
    }
  }

  async getBlockByTimestamp(timestamp: number): Promise<number | null> {
    const latestBlock = await this.alchemy.core.getBlock("latest");
    
    let low = 0;
    let high = latestBlock.number;
    
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);

      const block = await this.alchemy.core.getBlock(mid);
      
      if (block.timestamp === timestamp) {
        return block.number;
      }

      if (block.timestamp < timestamp) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return null;
  }  

  async getETHBalancesByEpochTime(epochTime: number) {
    try {
      let totalBalance = 0;
      
      const blockNumber = await this.getBlockRange(epochTime);

      if (blockNumber) {
        const holders = await this.getHoldersByBlockRange(blockNumber);
        
        totalBalance = holders.reduce((sum, holder) => sum + (holder.value || 0), 0);

        const balances = await Promise.all(
          holders.map(async (holder) => {
            const fromBalance = await this.alchemy.core.getBalance(holder.from) ?? BigNumber.from(0);
            const toBalance = await this.alchemy.core.getBalance(holder.to) ?? BigNumber.from(0);

            return fromBalance.add(toBalance);
          })
        );
    
        // Convert balances from Wei to ETH and sum them up
        balances.forEach((balance) => {
          totalBalance += parseFloat(Utils.formatEther(balance));
        });
      }

      console.log(`ETH value: ${totalBalance}`);
    } catch (error) {
      console.error('Failed to get ETH wallet values')
      throw error;
    }
  }

  async getBlockRange(epochTime: number): Promise<string> {
    const blockNumber = await this.getBlockByTimestamp(epochTime);
    
    return blockNumber ? `0x${blockNumber.toString(16)}` : null;
  }
}