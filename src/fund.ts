// Copyright 2025 Brick Towers

import pino from 'pino';
import pinoPretty from 'pino-pretty';
import {initWalletWithSeed} from "./utils";
import {MidnightBech32m} from '@midnight-ntwrk/wallet-sdk-address-format';
import * as rx from 'rxjs';
import * as ledger from '@midnight-ntwrk/ledger-v7';
import * as bip39 from 'bip39';
import {CombinedTokenTransfer} from "@midnight-ntwrk/wallet-sdk-facade";

const DEFAULT_LOG_LEVEL = process.env.LOG_LEVEL ?? 'info';
const TRANSFER_AMOUNT = 31_337_000_000n; // 1e12, adjust as needed

interface CliInput {
    mnemonic?: string;
    shieldedAddress?: string;
    unshieldedAddress?: string;
}

function getReceiverMnemonicsFromArgs(): CliInput {
    const [, , arg] = process.argv;

    const printUsage = () => {
        console.error(`
Usage:
  yarn fund "<mnemonic words>"
  yarn fund mn_shield-addr_undeployed...
  yarn fund mn_unshield-addr_undeployed...

Accepted inputs:
  • BIP-39 mnemonic (space-separated words)
  • Shielded address for the 'undeployed' network
  • Unshielded address for the 'undeployed' network

Examples:
  yarn fund "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
  yarn fund mn_shield-addr_undeployed1...
  yarn fund mn_unshield-addr_undeployed1...
`);
    };

    if (!arg) {
        console.error('No argument provided.');
        printUsage();
        process.exit(2);
    }

    // ---- mnemonic ----------------------------------------------------------
    if (bip39.validateMnemonic(arg)) {
        return { mnemonic: arg };
    }

    // ---- address handling --------------------------------------------------
    const isShielded = arg.startsWith('mn_shield-addr');
    const isUnshielded = arg.startsWith('mn_addr_');

    if (isShielded || isUnshielded) {
        const expectedPrefix = isShielded
            ? 'mn_shield-addr_undeployed'
            : 'mn_addr_undeployed';

        if (!arg.startsWith(expectedPrefix)) {
            const providedNetwork = arg
                .replace(isShielded ? 'mn_shield-addr_' : 'mn_addr_', '')
                .split('1')[0]; // best-effort extraction

            console.error(
                `Unsupported network in address: '${providedNetwork}'.\n` +
                `This script supports ONLY the 'undeployed' network.\n` +
                `Expected prefix:\n  ${expectedPrefix}...`
            );
            process.exit(2);
        }

        return isShielded
            ? { shieldedAddress: arg }
            : { unshieldedAddress: arg };
    }

    // ---- fallback ----------------------------------------------------------
    console.error(
        `Invalid argument provided.\n\n` +
        `Received:\n  ${arg.slice(0, 60)}${arg.length > 60 ? '...' : ''}`
    );
    printUsage();
    process.exit(2);
}


function createLogger() {
    const pretty = pinoPretty({
        colorize: true,
        sync: true,
    });

    return pino(
        {
            level: DEFAULT_LOG_LEVEL,
        },
        pretty,
    );
}

interface Stoppable {
    stop(): Promise<void>;
}

async function main(): Promise<void> {
    const logger = createLogger();
    let cliInput = getReceiverMnemonicsFromArgs();
    let stoppable : Stoppable[] = []
    if (cliInput.mnemonic) {
        const seed: Buffer = await bip39.mnemonicToSeed(cliInput.mnemonic);
        // To match Lace Wallet derivation, we take the first 32 bytes of the seed
        // This is unclear from BIP-39, but is what makes this interoperable with Lace
        const takeSeed = seed.subarray(0, 32);
        const receiver = await initWalletWithSeed(takeSeed);
        stoppable.push(receiver.wallet);
        const shieldedAddress: string = await rx.firstValueFrom(
            receiver.wallet.state().pipe(
                rx.filter((s) => s.isSynced),
                rx.map((s) => MidnightBech32m.encode('undeployed', s.shielded.address).toString()),
            ),
        );
        const unshieldedAddress: string = receiver.unshieldedKeystore.getBech32Address().toString();
        cliInput.shieldedAddress = shieldedAddress;
        cliInput.unshieldedAddress = unshieldedAddress;
        logger.info({ shieldedAddress, unshieldedAddress }, 'Derived receiver addresses from mnemonic');
    }

    try {
        const genesisWalletSeed = Buffer.from('0000000000000000000000000000000000000000000000000000000000000001', 'hex');
        const sender = await initWalletWithSeed(genesisWalletSeed);
        await rx.firstValueFrom(sender.wallet.state().pipe(rx.filter((s) => s.isSynced)));
        stoppable.push(sender.wallet);

        logger.info('Wallet setup complete');

        const outputs: CombinedTokenTransfer[] = [];
        if (cliInput.unshieldedAddress) outputs.push(
            {
                type: 'unshielded',
                outputs: [
                    {
                        amount: TRANSFER_AMOUNT,
                        receiverAddress: cliInput.unshieldedAddress,
                        type: ledger.unshieldedToken().raw,
                    },
                ],
            }
        );

        if (cliInput.shieldedAddress) outputs.push({
            type: 'shielded',
            outputs: [
                {
                    amount: TRANSFER_AMOUNT,
                    receiverAddress: cliInput.shieldedAddress,
                    type: ledger.shieldedToken().raw,
                },
            ],
        });


        const recipe = await sender.wallet.transferTransaction(
            sender.shieldedSecretKeys,
            sender.dustSecretKey,
            outputs,
            new Date(Date.now() + 30 * 60 * 1000),
        );

        const tx = await sender.wallet
            .signTransaction(recipe.transaction, (payload) => sender.unshieldedKeystore.signData(payload))

        logger.info(
            'Transfer recipe created',
        );

        const transaction = await sender.wallet
            .finalizeTransaction({ type: 'TransactionToProve', transaction: tx });

        logger.info('Transaction proof generated');

        const txHash = await sender.wallet.submitTransaction(transaction);
        logger.info({ txHash }, 'Transaction submitted');

    } catch (err) {
        logger.error(
            { err },
            'Error while preparing/submitting transfer transaction',
        );
        // Non-zero exit for CI or scripts
        process.exitCode = 1;
    } finally {
        for (const wallet of stoppable) {
            if (wallet) {
                await wallet.stop();
            }
        }
    }
}

main().catch((err) => {
    // Fallback if something happens before logger is available
    console.error('Unhandled error in main:', err);
    process.exit(1);
});
