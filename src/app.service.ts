import { Injectable } from '@nestjs/common';
import { Alchemy, AssetTransfersCategory, AssetTransfersWithMetadataResult, Network } from 'alchemy-sdk';
import { ethers } from 'ethers';

@Injectable()
export class AppService {
  private readonly ALCHEMY_APIKEY = process.env.ALCHEMY_API_KEY;
  private readonly BAYC_CONTRACT_ADDRESS = process.env.BAYC_CONTRACT_ADDRESS;

  private readonly alchemy: Alchemy;

  constructor() {
    this.alchemy = new Alchemy({
      apiKey: this.ALCHEMY_APIKEY,
      network: Network.ETH_MAINNET
    });
  }

  async run(epochTime: number) {
    this.getHello()
    await this.getETHBalancesByEpochTime(epochTime);
  }

  getHello() {
    console.log('Hello World!');
  }

  async getHoldersByEpochTime(blockNumberHexString: string): Promise<AssetTransfersWithMetadataResult[]> {
    try {
      const assetTransfers = await this.alchemy.core.getAssetTransfers({
        fromBlock: blockNumberHexString,
        toBlock: blockNumberHexString,
        category: [AssetTransfersCategory.ERC721, AssetTransfersCategory.EXTERNAL],
        contractAddresses: [this.BAYC_CONTRACT_ADDRESS],
        withMetadata: true,
      });
  
      return assetTransfers.transfers; 
    } catch (error) {
      console.error(`Failed to get holders`, error);
      throw error;
    }
  }

  private async getBlockNumberByTimestamp(timestamp: number): Promise<number> {
    let low = 0;
    let high = await this.alchemy.core.getBlockNumber();
    let blockNumber = high;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const block = await this.alchemy.core.getBlock(mid);

      if (block.timestamp === timestamp) {
        return mid;
      } else if (block.timestamp < timestamp) {
        low = mid + 1;
      } else {
        high = mid - 1;
        blockNumber = mid;
      }
    }

    return blockNumber;
  }

  async getETHBalancesByEpochTime(epochTime: number) {
    try {
      const blockNumber = await this.getBlockNumberByTimestamp(epochTime);
      console.log(`blockNumber : ${blockNumber}`);
      const blockNumberHexString = `0x${blockNumber.toString(16)}`;
      const holders = await this.getHoldersByEpochTime(blockNumberHexString);

      console.log(`holders: ${holders.length}`);
      
      const totalBalance = holders.reduce((sum, holder) => sum + (holder.value || 0), 0);

      console.log(totalBalance);
    } catch (error) {
      console.error('Failed to get ETH wallet values')
      throw error;
    }
  }
}
