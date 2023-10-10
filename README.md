# PIPE | DMT Wallet

The PIPE | DMT Wallet is a NodeJS wallet and indexer for PIPE protocol tokens.  It supports wallet creation, wallet imports as well as sending and receiving tokens.

The wallet is based on the PIPE | DMT specs found here: https://github.com/BennyTheDev/pipe-specs

Currently the wallet does not cover the creation of tokens and PIPE | Art. For those please consult available 3rd party services:

- https://pipe.inscrib3.land/
- https://www.pipex.space/
- https://pipemint.xyz/

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

## Usage

Enter the document root of the PIPE wallet and proceed with the following commands.
You might need to wait for the wallet to fully index before it returns results:

```
Create a new wallet with name <walletname>

node pipe.mjs walletcreate <walletname>
```

```
Import a wallet using a seed phrase for a new local wallet <walletname>

node pipe.mjs walletrestore <walletname> "<seedphrase>"
```

```
Create a new wallet address for wallet <walletname>

node pipe.mjs newaddress <walletname>
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

node pipe.mjs sendtokens <walletname> <address> <ticker> <ID> <amount> <feerate>
```

``` 
Send sats to a receiver from <walletname>:

node pipe.mjs sendsats <walletname> <address> <amount> <feerate>
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
