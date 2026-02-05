### Self-contained local Midnight node + wallet funding helper

▶️ **[Watch the Video Explainer & Demo](https://youtu.be/1L4xR8LIe6I)** (demo is showing an earlier version, but the concepts are the same)

`midnight-local-network` lets developers run their **own local Midnight network** using Docker—fully isolated, predictable, and independent from public testnets or faucets.

This setup is especially valuable for dApp developers who want to build and test against a fully local Midnight network instead of relying on public testnets, which may be unstable or temporarily unavailable.

It also includes a **wallet funding tool**, solving a key gap:
* When the Midnight Lace Wallet is connected to a local "Undeployed" network, **there is no built-in way to fund shielded and unshielded addresses**. 
 
This project provides that missing capability.

---

## 🌟 Why This Exists

Building on Midnight often requires stable environments, but public testnets and faucets can be:

- unavailable or undergoing maintenance
- rate-limited
- unstable for automated tests
- unsuitable for offline or reproducible local workflows

This repository enables you to:

- Spin up a **fully functional Midnight network locally**
- Connect the **Midnight Lace Preview Wallet** to that network
- **Fund** any shielded address directly using the provided script

Perfect for development, workshops, prototyping, CI, and experimentation.

---

## 🚀 Key Features

- 🔧 **Local Midnight network** via Docker Compose
- 🏦 **Funding script** for sending native tokens to shielded addresses
- 🧪 Works without external testnets or faucets
- 💼 Integrates with Midnight Lace Preview Wallet (“Undeployed” network)
- 🔌 Uses standard local ports:
    - Proof Server → `6300`
    - Node → `9944`
    - Indexer → `8088`

---

## 📓 Changelog / Compatibility Notes

This repository tracks compatibility against specific Midnight stacks.

| Repo Version | Ledger Stage | Lace     | Proof Server | Midnight Node | Indexer (standalone) | Notes |
| --- | --- |----------| --- | --- | --- | --- |
| [`1.0.0`](https://github.com/bricktowers/midnight-local-network/tree/1.0.0) | pre-ledger-v6 | `2.33.0` | `4.0.0` | `0.12.0` | `2.1.2` |  |
| [`2.0.0`](https://github.com/bricktowers/midnight-local-network/tree/2.0.0) | ledger-v6 | `2.37.0` | `6.1.0-alpha.6` | `0.18.0` |  | Unofficial “preview stack”; never announced officially |
| [`3.0.0`](https://github.com/bricktowers/midnight-local-network/tree/3.0.0) | ledger-v7 | `2.38.0` | `7.0.0` | `0.20.1` | `3.0.0` | Official preprod release |

---

## 🛠️ Prerequisites

Ensure you have the following tools installed on your system:

* **Git**
* **Docker** and **Docker Compose v2**
* **Node.js ≥ 22.16.0** (using [nvm](https://github.com/nvm-sh/nvm) is highly recommended for version management)
* **Yarn** (classic)
* **Lace Midnight ** (2.38.0 or later) browser extension

You will also need the Midnight Lace Wallet to connect and interact with the local node.

---

## 🚀 Setup & Usage Guide

Follow these steps to set up the local network and fund an address.

### 1. Clone the Repository

Clone the project and navigate into the directory:

```bash
git clone git@github.com:bricktowers/midnight-local-network.git midnight-local-network
cd midnight-local-network
```

### 2. Setup Node via nvm

Install and use Node 22.16+:
```bash
nvm install 22
nvm use 22
```

If you don’t have nvm, see:
https://github.com/nvm-sh/nvm

### 3. Install dependencies

```bash
yarn install
```   

### 2. Set Up Node Environment

The repository includes a compose.yml file that defines the local Midnight node/network services.

Start the network in detached mode (-d):

```bash
docker compose up -d
```

Tip: The explicit filename -f compose.yml is often optional, but can be used for clarity: docker compose -f compose.yml up -d.

### 3. Connect Midnight Lace Wallet

You need to configure your Midnight Lace Wallet to use your local node instead of a public testnet.

* Open the Wallet Settings -> Midnight in the Midnight Lace Wallet.

* Switch network to "Undeployed"

* Save the configuration and switch the wallet to use that new local network.

Once the wallet is connected and copy the address you want to fund.

### 4. Fund an Address

Once the local network is running, use the fund script to send native tokens to a receiver on the undeployed network.

This script accepts one argument and supports three input types:

* BIP-39 mnemonic (space-separated words) — the script will derive both receiver addresses:
  * a shielded address (`mn_shield-addr_undeployed...`)
  * an unshielded address (`mn_addr_undeployed...`)
* A Midnight shielded address for undeployed (`mn_shield-addr_undeployed...`)
* A Midnight unshielded address for undeployed (`mn_addr_undeployed...`)

If you pass a mnemonic, the script derives the receiver addresses and funds both (shielded + unshielded). If you pass a single address, it funds only that address.

Usage:

```bash
yarn fund "<mnemonic words>"
yarn fund mn_shield-addr_undeployed1...
yarn fund mn_addr_undeployed1...
```
Example:  

Fund both derived addresses (shielded + unshielded) from a mnemonic:
```bash
yarn fund "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
```
Fund a specific shielded address:
```bash
yarn fund mn_shield-addr_undeployed1q....

```
Fund a specific unshielded address:
```bash
yarn fund mn_addr_undeployed1q....
```
#### Notes

- You can use the **BIP-39 mnemonic generated by Midnight Lace at wallet creation time** as input to this script. When a mnemonic is provided, the script derives the corresponding **shielded** and **unshielded** addresses exactly as Lace would.
- When using a mnemonic, the script logs the derived `shieldedAddress` and `unshieldedAddress` once the wallet has fully synced.
- Shielded addresses are most commonly obtained directly from the **Midnight Lace Wallet**, but supplying the original mnemonic is useful for automated or headless setups.
- The script **only supports the `undeployed` network**. If you provide an address from another network (i.e. the prefix does not match `mn_shield-addr_undeployed...` or `mn_addr_undeployed...`), the script will exit with an error.

### 5. Connect your dApp

Typically, your dApp will use the `dapp-connector-api` to communicate with the Midnight Lace Wallet.
When running locally, this automatically configures your dApp to connect to the “Undeployed” network.

However, if you are interacting with Midnight using CLI tooling instead of the dApp connector, 
you’ll need to manually set the endpoints in your dApp’s configuration:
```
export class TestnetLocalConfig implements Config {
...
  indexer = 'http://127.0.0.1:8088/api/v1/graphql';
  indexerWS = 'ws://127.0.0.1:8088/api/v1/graphql/ws';
  node = 'http://127.0.0.1:9944';
  proofServer = 'http://127.0.0.1:6300';
...
  setNetworkId() {
    setNetworkId(NetworkId.Undeployed);
  }
}
```
