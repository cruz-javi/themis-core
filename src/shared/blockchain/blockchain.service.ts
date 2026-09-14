import { Inject, Injectable, Logger } from '@nestjs/common';
import { Contract, JsonRpcProvider, Wallet } from 'ethers';
import { APP_CONFIG } from '../../config/configuration';
import type { AppConfig } from '../../config/configuration';

export const THEMIS_REGISTRY_ABI = [
  'function version() view returns (string)',
  'function pingCount() view returns (uint256)',
  'function ping() returns (uint256)',
  'event Pinged(address indexed sender, uint256 count)',
];

export interface ChainStatus {
  connected: boolean;
  chainId: number | null;
  blockNumber: number | null;
  relayerAddress: string | null;
  contractAddress: string | null;
  contractVersion: string | null;
  error: string | null;
}

@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);
  private readonly provider: JsonRpcProvider;
  private readonly wallet: Wallet;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    this.provider = new JsonRpcProvider(config.chain.rpcUrl, undefined, {
      staticNetwork: true,
    });
    this.wallet = new Wallet(config.chain.relayerPrivateKey, this.provider);
  }

  get relayerAddress(): string {
    return this.wallet.address;
  }

  getRegistry(): Contract | null {
    if (!this.config.chain.contractAddress) {
      return null;
    }

    return new Contract(
      this.config.chain.contractAddress,
      THEMIS_REGISTRY_ABI,
      this.wallet,
    );
  }

  async getStatus(): Promise<ChainStatus> {
    const status: ChainStatus = {
      connected: false,
      chainId: null,
      blockNumber: null,
      relayerAddress: null,
      contractAddress: this.config.chain.contractAddress || null,
      contractVersion: null,
      error: null,
    };

    try {
      const network = await this.provider.getNetwork();
      status.chainId = Number(network.chainId);
      status.blockNumber = await this.provider.getBlockNumber();
      status.relayerAddress = this.wallet.address;
      status.connected = true;

      const registry = this.getRegistry();
      if (registry) {
        status.contractVersion = (await registry.version()) as string;
      }
    } catch (error) {
      status.error = (error as Error).message;
      this.logger.warn(`Blockchain inalcanzable: ${status.error}`);
    }

    return status;
  }
}
