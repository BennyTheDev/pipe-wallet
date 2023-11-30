# PIPE | DMT Wallet

The PIPE | DMT Wallet is a NodeJS wallet and indexer for PIPE protocol tokens.  It supports wallet creation, wallet imports as well as sending and receiving tokens.

The wallet is based on the PIPE | DMT specs found here: https://github.com/BennyTheDev/pipe-specs

Currently the wallet does not cover the creation of tokens and PIPE | Art. For those please consult available 3rd party services:

- https://inspip.com/
- https://ppline.app/
- https://www.satsx.io/
- https://www.pipex.space/

NOTE: this is a pre-alpha release of the PIPE wallet and there are no guarantees everything will work perfectly!

## Requirements

- Windows, Linux (macOS should work, too)
- Fully indexed Bitcoin Core 24.0.1+ node (config: rpc=1, server=1, txindex=1)
- Bitcoin Core and bitcoin-cli binaries must run on the same host like the wallet
- PIPE | DMT Wallet
- Node >= 18.13.0 & NPM

## Installation

- Run Bitcoin Core in mainnet, testnet or signet mode
- Install node dependencies: npm install
- Adjust config/default.json and adjust "bitcoin_cli_path":
  - Point to your bitcoin-cli (bitcoin-cli.exe)
  - Full path required
  - Quote backslashes if you are using them on Windows
- For faster indexing, you may optionally download the pipe db (https://trac.network/pipe-db.zip).
- - Just download, unzip and put the "pipe" folder into your pipe document root (same location as pipe.mjs)

## Updates

If you update straight from the sources, makes sure to run npm install to get the latest package state:

```
cd /path/to/pipe/
npm install
```

## Usage

Enter the document root of the PIPE wallet and proceed with the following commands.
You might need to wait for the wallet to fully index before it returns results. 

If running on testnet or signet, you need to add the "testnet" argument at the end of each command. This is very important, especially upon initial and continuous indexing.

```
Create a new wallet with name <walletname>

node pipe.mjs walletcreate <walletname>
```

```
Import a wallet using a seed phrase for a new local wallet <walletname>

node pipe.mjs walletrestore <walletname> "<seedphrase>" <optional: custom derivation path>

Note: after restore, you might not see your balances using the "getbalances".
In order to load your balances, please use bitcoin-cli's "rescanblockchain" command separately:

/path/to/bitcoin-cli -rpcwallet=<walletname> rescanblockchain 809607

or Windows

d:/path/to/bitcoin-cli.exe -rpcwallet=<walletname> rescanblockchain 809607

809607 is the earliest block relevant for tokens. If you own satoshis from before, you'll need to set an earlier block.
```

```
Create a new wallet address for wallet <walletname>

node pipe.mjs newaddress <walletname> <optional: custom derivation path>
```

``` 
Get all sats and token balances for a wallet:

node pipe.mjs getbalances <walletname>
```

``` 
Get token balance for a specific <address> associated with it utxo:

node pipe.mjs getbalance <address> <ticker> <ID>
```

``` 
Send tokens to a receiver from <walletname>:

node pipe.mjs sendtokens <walletname> <address> <ticker> <ID> <amount> <feerate> <optional: custom change address>
```

``` 
Send sats to a receiver from <walletname>:

node pipe.mjs sendsats <walletname> <address> <amount> <feerate> <optional: custom change address>
```

``` 
Get deployment details for a specific token:

node pipe.mjs getdeployment <ticker> <ID>
```

``` 
Get collectible details for a specific collection and item number:

node pipe.mjs getcollectible <collectionaddress> <number>
```

``` 
Get the max. number for a collection:

node pipe.mjs getcollectiblemax <collectionaddress>
```

## TODO

- Transaction history stream (websockets)
- Built-in token & art explorer
- Token and art creation
- Auto re-indexing upon reorgs
- Modularization of code & tests
- Testing, testing, testing
