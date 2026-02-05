// Copyright 2025 Brick Towers

import * as ledger from '@midnight-ntwrk/ledger-v7';
import * as bip39 from 'bip39';
import {CombinedTokenTransfer} from "@midnight-ntwrk/wallet-sdk-facade";
import {
    createLogger,
    deriveReceiverFromMnemonic,
    fundFromGenesis,
    initGenesisSender,
    TRANSFER_AMOUNT,
} from './fund-lib';

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


interface Stoppable {
    stop(): Promise<void>;
}

async function main(): Promise<void> {
    const logger = createLogger();
    let cliInput = getReceiverMnemonicsFromArgs();
    let stoppable : Stoppable[] = []
    if (cliInput.mnemonic) {
        const receiver = await deriveReceiverFromMnemonic(cliInput.mnemonic);
        stoppable.push(receiver.walletBundle.wallet);
        cliInput.shieldedAddress = receiver.shieldedAddress;
        cliInput.unshieldedAddress = receiver.unshieldedAddress;
        logger.info(
            { shieldedAddress: receiver.shieldedAddress, unshieldedAddress: receiver.unshieldedAddress },
            'Derived receiver addresses from mnemonic',
        );
    }

    try {
        const sender = await initGenesisSender();
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


        logger.info('Transfer recipe created');
        const txHash = await fundFromGenesis(sender, outputs);
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
