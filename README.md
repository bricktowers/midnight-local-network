### Self-contained local Midnight node + wallet funding helper

▶️ **[Watch the Video Explainer & Demo](https://youtu.be/1L4xR8LIe6I)**  

`midnight-local-network` lets developers run their **own local Midnight network** using Docker—fully isolated, predictable, and independent from public testnets or faucets.

This setup is especially valuable for dApp developers who want to build and test against a fully local Midnight network instead of relying on public testnets, which may be unstable or temporarily unavailable.

It also includes a **wallet funding tool**, solving a key gap:
* When the Midnight Lace Wallet is connected to a local "Undeployed" network, **there is no built-in way to fund shielded addresses**. 
 
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

## ⚠️ Preview network readiness & wallet compatibility

Midnight is currently in the process of preparing everything for the Preview network.

Lace has released a Preview-compatible wallet, but it does not work with this local “Undeployed” setup yet.

Until everything is ready for Preview, we recommend using the previous version of the Lace Midnight wallet: **v2.33.0**.

Download (Chrome): https://chrome-stats.com/d/hgeekaiplokcnmakghbdfbgnlfheichg/download

---

## 🛠️ Prerequisites

Ensure you have the following tools installed on your system:

* **Git**
* **Docker** and **Docker Compose v2**
* **Node.js ≥ 22.16.0** (using [nvm](https://github.com/nvm-sh/nvm) is highly recommended for version management)
* **Yarn** (classic)

You will also need the Midnight Lace Wallet to connect and interact with the local node.
⚠️ Important: The newer Preview-compatible Lace wallet does not work with this local “Undeployed” setup at the moment. Please use Lace Midnight Wallet v2.33.0 instead:
https://chrome-stats.com/d/hgeekaiplokcnmakghbdfbgnlfheichg/download

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

Once the local network is running, use the fund script to send native tokens to any valid shielded address.

The address should be a valid **Midnight shielded address**, typically one generated within the **Midnight Lace Wallet**.

```bash
yarn fund mn_shield-addr_undeployed1234abcd...
```

### 4. Connect your dApp

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



