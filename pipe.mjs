import { Address, Script, Signer, Tap, Tx } from '@cmdcode/tapscript';
import { Level } from 'level';
import * as ecc from 'tiny-secp256k1';
import _bip32 from "bip32";
const { BIP32Factory } = _bip32;
const bip32 = BIP32Factory(ecc);
import bip39 from "bip39";
import {exec} from "child_process";
import Os from 'os'
import goodbye from 'graceful-goodbye'
import config from 'config'

/*
* WARNING: This is an initial, pre-alpha PIPE protocol POC/MVP PIPE wallet & indexer.
*          This version is not meant to be used in production!
*
* Goal is to develop this into fully fledged PIPE wallet that sits on top of Bitcoin Core.
* There is no reorg detection yet, if a reorg happens, it needs to re-index from scratch.
* Many things will change and be transformed into an NPM package with proper sub-packaging and code-style.
 */

const btc_cli_path = config.get('bitcoin_cli_path');
let block = config.get('start_block');
let legacy_block_end = 810000;

const db = new Level('pipe', { valueEncoding: 'json'  });

const op_table = {
    p : '50',
    d : '44',
    m : '4d',
    a : '41',
    i : '49',
    r : '52',
    n : '4e',
    tr : '5452',
    t : '54',
    b : '42',
    "i_OP_0" : 0,
    "i_OP_FALSE" : 0,
    "i_OP_1" : 1,
    "i_OP_TRUE" : 1,
    "i_OP_2" : 2,
    "i_OP_3" : 3,
    "i_OP_4" : 4,
    "i_OP_5" : 5,
    "i_OP_6" : 6,
    "i_OP_7" : 7,
    "i_OP_8" : 8,
    "i_OP_9" : 9,
    "i_OP_10" : 10,
    "i_OP_11" : 11,
    "i_OP_12" : 12,
    "i_OP_13" : 13,
    "i_OP_14" : 14,
    "i_OP_15" : 15,
    "i_OP_16" : 16,
};

// might become handy later w/ explorer feature
let supported_mimes = [
    'application/json',
    'application/pdf',
    'application/pgp-signature',
    'application/protobuf',
    'application/yaml',
    'audio/flac',
    'audio/mpeg',
    'audio/wav',
    'image/apng',
    'image/avif',
    'image/gif',
    'image/jpeg',
    'image/png',
    'image/svg+xml',
    'image/webp',
    'model/gltf+json',
    'model/gltf-binary',
    'model/stl',
    'text/css',
    'text/html',
    'text/html;charset=utf-8',
    'text/javascript',
    'text/markdown',
    'text/markdown;charset=utf-8',
    'text/plain',
    'text/plain;charset=utf-8',
    'video/mp4',
    'video/webm'
];

// get the latest recorded block
try
{
    block = parseInt(await db.get('b'));
}
catch(e) {}

goodbye(async function()
{
    //console.log('shutting down, please wait...');

    while(true)
    {
        try
        {
            await db.get('mrk');
        }
        catch(e)
        {
            //console.log('goodbye');
            return;
        }

        await sleep(10);
    }
});

/**
 * Managing cli commands
 */
if(process.argv.length !== 0)
{
    switch(process.argv[2].toLowerCase())
    {
        case 'sendtokens':
            if(await mustIndex()) {
                block += 1;
                await index(typeof process.argv[10] === 'undefined' ? 'main' : process.argv[10]);
            }
            if(typeof process.argv[10] === 'undefined')
            {
                process.stdout.write(await sendTokens(process.argv[3], process.argv[4], process.argv[5], process.argv[6], process.argv[7], process.argv[8], 0, typeof process.argv[9] !== 'undefined' && process.argv[9] !== 'null' ? process.argv[9] : null) + "\n");
            }
            else
            {
                process.stdout.write(await sendTokens(process.argv[3], process.argv[4], process.argv[5], process.argv[6], process.argv[7], process.argv[8], 0, typeof process.argv[9] !== 'undefined' && process.argv[9] !== 'null' ? process.argv[9] : null, process.argv[10]) + "\n");
            }
            break;
        case 'sendsats':
            if(await mustIndex()) {
                block += 1;
                await index(typeof process.argv[8] === 'undefined' ? 'main' : process.argv[8]);
            }
            if(typeof process.argv[8] === 'undefined')
            {
                process.stdout.write(await sendSats(process.argv[3], process.argv[4], process.argv[5], process.argv[6], 0, typeof process.argv[7] !== 'undefined' && process.argv[7] !== 'null' ? process.argv[7] : null) + "\n");
            }
            else
            {
                process.stdout.write(await sendSats(process.argv[3], process.argv[4], process.argv[5], process.argv[6], 0, typeof process.argv[7] !== 'undefined' && process.argv[7] !== 'null' ? process.argv[7] : null, process.argv[8]) + "\n");
            }
            break;
        case 'walletrestore':
            if(await mustIndex()) {
                block += 1;
                await index(typeof process.argv[6] === 'undefined' ? 'main' : process.argv[6]);
            }
            if(typeof process.argv[6] !== 'undefined')
            {
                process.stdout.write(await createWallet(process.argv[3], true, process.argv[4], typeof process.argv[5] !== 'undefined' && process.argv[5] !== 'null' ? process.argv[5] : null, process.argv[6])+"\n");
            }
            else
            {
                process.stdout.write(await createWallet(process.argv[3], true, process.argv[4], typeof process.argv[5] !== 'undefined' && process.argv[5] !== 'null' ? process.argv[5] : null)+"\n");
            }
            break;
        case 'walletcreate':
            if(await mustIndex()) {
                block += 1;
                await index(typeof process.argv[5] === 'undefined' ? 'main' : process.argv[5]);
            }
            if(typeof process.argv[5] !== 'undefined')
            {
                process.stdout.write(await createWallet(process.argv[3], false, null, typeof process.argv[4] !== 'undefined' && process.argv[4] !== 'null' ? process.argv[4] : null, process.argv[5])+"\n");
            }
            else
            {
                process.stdout.write(await createWallet(process.argv[3], false, null, typeof process.argv[4] !== 'undefined' && process.argv[4] !== 'null' ? process.argv[4] : null)+"\n");
            }
            break;
        case 'newaddress':
            if(await mustIndex()) {
                block += 1;
                await index(typeof process.argv[4] === 'undefined' ? 'main' : process.argv[4]);
            }
            process.stdout.write(await createAddress(process.argv[3])+"\n");
            break;
        case 'getcollectible':
            if(await mustIndex()) {
                block += 1;
                await index(typeof process.argv[5] === 'undefined' ? 'main' : process.argv[5]);
            }
            process.stdout.write(JSON.stringify(await getCollectible(process.argv[3], parseInt(process.argv[4])))+"\n");
            break;
        case 'getcollectiblemax':
            if(await mustIndex()) {
                block += 1;
                await index(typeof process.argv[4] === 'undefined' ? 'main' : process.argv[4]);
            }
            process.stdout.write(JSON.stringify(await getCollectibleMax(process.argv[3]))+"\n");
            break;
        case 'getdeployment':
            if(await mustIndex()) {
                block += 1;
                await index(typeof process.argv[5] === 'undefined' ? 'main' : process.argv[5]);
            }
            process.stdout.write(JSON.stringify(await getDeployment(process.argv[3], parseInt(process.argv[4])))+"\n");
            break;
        case 'getbalance':
            if(await mustIndex()) {
                block += 1;
                await index(typeof process.argv[6] === 'undefined' ? 'main' : process.argv[6]);
            }
            process.stdout.write(JSON.stringify(await getBalance(process.argv[3], process.argv[4], parseInt(process.argv[5])))+"\n");
            break;
        case 'getbalances':
            if(await mustIndex()) {
                block += 1;
                await index(typeof process.argv[4] === 'undefined' ? 'main' : process.argv[4]);
            }
            process.stdout.write(await getBalances(process.argv[3])+"\n");
            break;
        default:
            process.stdout.write('{"error":true,"message":"Unknown command"}'+"\n");
            break;
    }
}

/**
 * Returns the current max. number for a collectible
 *
 * @param address
 * @returns {Promise<any|null>}
 */
async function getCollectibleMax(address)
{
    try
    {
        return JSON.parse(await db.get('c_max_' + address));
    }
    catch(e) {}

    return null;
}

/**
 * Returns the collectible information, if any (PIPE | Art)
 *
 * @param address
 * @param num
 * @returns {Promise<any|null>}
 */
async function getCollectible(address, num)
{
    try
    {
        return JSON.parse(await db.get('c_' + address + '_' + num));
    }
    catch(e) {}

    return null;
}

/**
 * Returns the deployment data of a selected set of ticker and id.
 *
 * @param ticker
 * @param id
 * @returns {Promise<any|null>}
 */
async function getDeployment(ticker, id)
{
    try
    {
        return JSON.parse(await db.get('d_' + ticker.toLowerCase() + '_' + id));
    }
    catch(e) {}

    return null;
}

/**
 * Returns an address (utxo) based token balance.
 *
 * @param address
 * @param ticker
 * @param id
 * @returns {Promise<{ticker, amt_big: string, decimals: *, amt, id}|null>}
 */
async function getBalance(address, ticker, id)
{
    try
    {
        let deployment = await getDeployment(ticker, id);
        if(deployment !== null)
        {
            const address_amt = 'a_' + address + '_' + ticker.toLowerCase() + '_' + id;
            let amt = BigInt(await db.get(address_amt));
            return {
                ticker : deployment.tick,
                id : deployment.id,
                decimals : deployment.dec,
                amt_big : amt.toString(),
                amt  : cleanFloat(formatNumberString(amt.toString(), deployment.dec))
            };
        }
    }
    catch(e) {}

    return null;
}

/**
 * Returns all token and sats balances.
 * Token balances can still show if already in mempool.
 *
 * @param name
 * @returns {Promise<string>}
 */
async function getBalances(name)
{
    try
    {
        await exe(btc_cli_path + ' unloadwallet ' + name);
    }  catch(f) {}

    await exe(btc_cli_path + ' loadwallet '+name);

    const unspent_result = await exe(btc_cli_path + ' -rpcwallet='+name+' listunspent', { maxBuffer: 1024 * 1024 * 10000 });
    const unspents = JSON.parse(unspent_result.trim());
    let balances = { sats : 0n, btc : 0};

    for(let i = 0; i < unspents.length; i++)
    {
        if(
            unspents[i].confirmations > 0 &&
            unspents[i].spendable &&
            unspents[i].solvable &&
            unspents[i].safe
        )
        {
            const utxo = 'utxo_' + unspents[i].txid + '_' + unspents[i].vout;

            try
            {
                let _utxo = await db.get(utxo);

                _utxo = JSON.parse(_utxo);

                if(typeof balances[_utxo.tick+':'+_utxo.id] === 'undefined')
                {
                    balances[_utxo.tick+':'+_utxo.id] = 0n;
                }

                balances[_utxo.tick+':'+_utxo.id] += BigInt(_utxo.amt);
            }
            catch(e)
            {
                balances.sats += BigInt(resolveNumberString(''+unspents[i].amount, 8));
                balances.btc += unspents[i].amount;
            }
        }
    }

    for(let sig in balances)
    {
        if(sig != 'btc' && sig != 'sats')
        {
            const splitted = sig.split(':');
            const deployment = await getDeployment(splitted[0], parseInt(splitted[1]));

            if(deployment !== null)
            {
                balances[sig] = cleanFloat(formatNumberString(balances[sig].toString(), deployment.dec));
            }
        }
        else if(sig === 'sats')
        {
            balances[sig] = balances[sig].toString();
        }
        else if(sig === 'btc')
        {
            balances[sig] = cleanFloat(formatNumberString(resolveNumberString(''+balances[sig], 8), 8));
        }
    }

    return JSON.stringify(balances);
}

/**
 * Main indexing function.
 * Calls DMT functions, depending on the op_return status.
 *
 * @param network
 * @returns {Promise<void>}
 */
async function index(network = 'main')
{

    try
    {
        try
        {
            const block_check = await db.get('bchk');

            if(block_check === block)
            {
                console.log('Database corrupted. Please remove the "pipe" folder and re-index. Make sure not to interrupt the indexing process.');
                return;
            }

        } catch(e) {}

        try
        {
            await db.get('reorg');
            console.log('Reorg detected at block ' + ( block - 1 ) + '. Please remove the "pipe" folder and re-index.');
            return;
        } catch(e) {}

        if(block > 0)
        {
            let prev_blockhash = await exe(btc_cli_path + ' getblockhash ' + ( block - 1 ), { maxBuffer: 1024 * 1024 * 10000 });
            prev_blockhash = prev_blockhash.trim();

            try
            {
                let prev_recorded_blockhash =  await db.get('bh');

                if(prev_blockhash !== prev_recorded_blockhash)
                {
                    await db.put('reorg', '');
                }
            } catch(e) {}
        }

        let blockhash = await exe(btc_cli_path + ' getblockhash ' + block, { maxBuffer: 1024 * 1024 * 10000 });
        blockhash = blockhash.trim();

        let tx = await exe(btc_cli_path + ' getblock "'+blockhash+'" 3', { maxBuffer: 1024 * 1024 * 10000 });
        tx = JSON.parse(tx.trim());

        await db.put('mrk', '');
        await db.put('bchk', block);

        for(let i = 0; i < tx.tx.length; i++)
        {
            try
            {
                const hex = tx.tx[i].hex;
                const res = Tx.decode(hex);

                let op_return_vout = -1;
                let op_return_count = 0;
                let decoded = null;

                for(let j = 0; j < res.vout.length; j++)
                {
                    decoded = Script.decode(res.vout[j].scriptPubKey, false);

                    if(decoded.length > 0 &&
                        decoded[0] === 'OP_RETURN')
                    {
                        op_return_vout = j;
                        op_return_count += 1;
                    }
                }

                let spent_token_count = {};
                let the_sig = '';

                for(let j = 0; j < res.vin.length; j++)
                {
                    const utxo = 'utxo_' + res.vin[j].txid + '_' + res.vin[j].vout;

                    try
                    {
                        const _utxo = await db.get(utxo);
                        const old_utxo = JSON.parse(_utxo);

                        const address_amt = 'a_' + old_utxo.addr + '_' + old_utxo.tick + '_' + old_utxo.id;

                        try
                        {
                            let amt = BigInt(await db.get(address_amt));
                            old_utxo.amt = BigInt(old_utxo.amt);
                            amt -= old_utxo.amt;
                            if(amt < 0n)
                            {
                                amt = 0n;
                            }
                            await db.put(address_amt, amt.toString());
                            await db.put('spent_' + utxo, _utxo);
                            await db.del(utxo);

                            // in case needed later on to assign non-op_return transactions
                            let sig = old_utxo.tick + '_' + old_utxo.id;

                            if(the_sig === '')
                            {
                                the_sig = sig;
                            }

                            if(sig === the_sig)
                            {
                                if(typeof spent_token_count[sig] === 'undefined')
                                {
                                    spent_token_count[sig] = 0n;
                                }

                                spent_token_count[sig] += BigInt(old_utxo.amt);
                            }
                        }
                        catch(e) {}
                    }
                    catch(e) {}
                }

                try
                {
                    decoded = Script.decode(res.vout[op_return_vout].scriptPubKey, false);
                } catch(e) {}

                if(
                    decoded !== null &&
                    decoded.length > 2 &&
                    decoded[0] === 'OP_RETURN' &&
                    decoded[1] === op_table.p
                )
                {
                    if(op_return_count !== 1) continue;
                    if(res.vout.length < 2) continue;

                    switch(decoded[2])
                    {
                        case op_table.d:
                            await indexDeployment(block, blockhash, op_return_vout, tx.tx[i], res, decoded, network);
                            break;
                        case op_table.m:
                            await indexMint(block, blockhash, op_return_vout, tx.tx[i], res, decoded, network);
                            break;
                        case op_table.t:
                            await indexTransfer(block, blockhash, op_return_vout, tx.tx[i], res, decoded, network);
                            break;
                    }
                }
                else
                {

                    // in case no valid op_return was given but utxos contained tokens,
                    // we try to associate all tokens of the first token type found (ticker:id)
                    // of all inputs with the first output, that is not an op_return.
                    // all other token types in inputs must be skipped.

                    // there is only 1 sig, it's just a bit more convenient that way
                    for(let sig in spent_token_count)
                    {
                        // we only loop to find potential op_returns.
                        // as soon as the first addressable output is found, we associate the tokens and break from the loop.
                        for(let j = 0; j < res.vout.length; j++)
                        {
                            decoded = Script.decode(res.vout[j].scriptPubKey, false);

                            if( decoded[0] !== 'OP_RETURN' )
                            {
                                try
                                {
                                    const to_address = Address.fromScriptPubKey(res.vout[j].scriptPubKey, network);
                                    const utxo = 'utxo_' + tx.tx[i].txid + '_' + j;
                                    const address_amt = 'a_' + to_address + '_' + sig;

                                    let pair = sig.split('_');
                                    let deployment = await getDeployment(pair[0], parseInt(pair[1]));

                                    if(deployment === null)
                                    {
                                        continue;
                                    }

                                    const _utxo = {
                                        addr : to_address,
                                        txid : tx.tx[i].txid,
                                        vout : j,
                                        tick : deployment.tick,
                                        id : deployment.id,
                                        amt : spent_token_count[sig].toString()
                                    };

                                    try
                                    {
                                        let amt = await db.get(address_amt);
                                        amt = BigInt(amt) + spent_token_count[sig];
                                        await db.put(address_amt, amt.toString());
                                        await db.put(utxo, JSON.stringify(_utxo));
                                    }
                                    catch(e)
                                    {
                                        await db.put(address_amt, spent_token_count[sig].toString());
                                        await db.put(utxo, JSON.stringify(_utxo));
                                    }

                                    break;
                                }
                                catch(e) {}
                            }
                        }

                        break;
                    }
                }
            }
            catch(e) {}
        }

        await db.put('b', block);
        await db.put('bh', blockhash);
        await db.del('mrk');
    }
    catch(e) {}

    console.log('Done indexing block', block);

    if(await mustIndex())
    {
        block += 1;
        await sleep(1);
        await index(network);
    }
}

/**
 * Transfer function to associate tokens based on the op_return data.
 * Creates 4 outputs: 0 = recipient, 1 = token change, 2 = op_return, 3 = sats change
 *
 * @param block
 * @param blockhash
 * @param vout
 * @param tx
 * @param res
 * @param ops
 * @param network
 * @returns {Promise<void>}
 */
async function indexTransfer(block, blockhash, vout, tx, res, ops, network = 'main')
{
    // op count must be uneven
    if(ops.length % 2 === 0) return;

    // must at least include a full quadruple
    if(ops.length < 7) return;

    // let's check for the amount of quadruples we got
    const tuples_length = ops.length - 3;

    // check for potential presence of all quadruples
    if(tuples_length % 4 !== 0) return;

    let utxos = [];
    let outputs = [];

    for(let i = 3; i < ops.length; i += 4)
    {
        let hex = ops[ i ];
        let base = 10;
        let bn = BigInt('0x' + hex);
        let int_ticker = BigInt(bn.toString(base));

        const ticker = toString26(int_ticker);
        if(ticker === '') return;

        const id = ops[ i + 1 ].startsWith('OP_') && typeof op_table['i_'+ops[i + 1]] !== 'undefined' ? op_table['i_'+ops[i + 1]] : parseInt(ops[i + 1], 16);
        if(isNaN(id) || id < 0 || id > 999999) return;

        const output = ops[ i + 2 ].startsWith('OP_') && typeof op_table['i_'+ops[i + 2]] !== 'undefined' ? op_table['i_'+ops[i + 2]] : parseInt(ops[i + 2], 16);
        if(isNaN(output) || output < 0) return;

        let transfer;

        if(block < legacy_block_end)
        {
            if(isNaN(parseInt(hexToString(ops[ i + 3 ]))))
            {
                transfer = ops[ i + 3 ];
            }
            else
            {
                transfer = hexToString(ops[ i + 3 ]);
            }
        }
        else
        {
            transfer = hexToString(ops[ i + 3 ]);
        }

        if( transfer.startsWith('0') && !transfer.startsWith('0.') ) return;
        if( transfer.includes('.') && transfer.endsWith('0') ) return;
        if( transfer.endsWith('.') ) return;

        let deployment = await getDeployment(ticker, id);

        if(deployment !== null)
        {
            if(countDecimals(transfer) > deployment.dec) return;

            transfer = resolveNumberString(transfer, deployment.dec);

            let _total_limit = BigInt('18446744073709551615');
            let _transfer = BigInt(transfer);

            if(_transfer <= 0 || _transfer > _total_limit) return;

            if(typeof res.vout[output] === 'undefined') return;
            let res_vout = Script.decode(res.vout[output].scriptPubKey, false);
            if(res_vout[0] === 'OP_RETURN') return;

            try
            {
                const to_address = Address.fromScriptPubKey(res.vout[output].scriptPubKey, network);

                const _utxo = {
                    addr : to_address,
                    txid : tx.txid,
                    vout : output,
                    tick : deployment.tick,
                    id : deployment.id,
                    amt : _transfer.toString()
                };

                // outputs can only be used once or the transfer is invalid and tokens are lost
                if(outputs.includes(output))
                {
                    utxos = [];
                    break;
                }

                utxos.push(_utxo);
                outputs.push(output);

                //console.log('1st push', _utxo);
            }
            catch(e)
            {
                console.log(e);
            }
        }
    }

    if(utxos.length > 0)
    {
        let token_count = {};
        let spent_token_count = {};

        for(let i = 0; i < res.vin.length; i++)
        {
            try
            {
                let spent_utxo = await db.get('spent_utxo_' + res.vin[i].txid + '_' + res.vin[i].vout);
                spent_utxo = JSON.parse(spent_utxo);

                let sig = spent_utxo.tick + '-' + spent_utxo.id;

                if(typeof spent_token_count[sig] === 'undefined')
                {
                    spent_token_count[sig] = 0n;
                }

                spent_token_count[sig] += BigInt(spent_utxo.amt);
            }
            catch(e) {}
        }

        for(let i = 0; i < utxos.length; i++)
        {
            let sig = utxos[i].tick + '-' + utxos[i].id;

            if(typeof token_count[sig] === 'undefined')
            {
                token_count[sig] = 0n;
            }

            token_count[sig] += BigInt(utxos[i].amt);
        }

        for(let sig in spent_token_count)
        {
            if(typeof token_count[sig] !== 'undefined')
            {
                if(spent_token_count[sig] < token_count[sig])
                {
                    // token count cannot exceed the spent count.
                    // invalid transfer.
                    return;
                }
            }
        }

        //console.log('2nd push', spent_token_count, token_count);

        for(let i = 0; i < utxos.length; i++)
        {
            const utxo = 'utxo_' + utxos[i].txid + '_' + utxos[i].vout;
            const address_amt = 'a_' + utxos[i].addr + '_' + utxos[i].tick + '_' + utxos[i].id;

            try
            {
                let amt = await db.get(address_amt);
                amt = BigInt(amt) + BigInt(utxos[i].amt);
                await db.put(address_amt, amt.toString());
                await db.put(utxo, JSON.stringify(utxos[i]));
                //console.log('3rd push', utxos[i]);
            }
            catch(e)
            {
                await db.put(address_amt, utxos[i].amt);
                await db.put(utxo, JSON.stringify(utxos[i]));
                //console.log('4th push', utxos[i]);
            }
        }
    }
}

/**
 * Manages mints for the selected ticker:id in the op_return it is processing.
 *
 * @param block
 * @param blockhash
 * @param vout
 * @param tx
 * @param res
 * @param ops
 * @param network
 * @returns {Promise<void>}
 */
async function indexMint(block, blockhash, vout, tx, res, ops, network = 'main')
{
    if(ops.length !== 7) return;

    let hex = ops[3];
    let base = 10;
    let bn = BigInt('0x' + hex);
    let int_ticker = BigInt(bn.toString(base));

    const ticker = toString26(int_ticker);
    if(ticker === '') return;

    const id = ops[4].startsWith('OP_') && typeof op_table['i_'+ops[4]] !== 'undefined' ? op_table['i_'+ops[4]] : parseInt(ops[4], 16);
    if(isNaN(id) || id < 0 || id > 999999) return;

    const output = ops[5].startsWith('OP_') && typeof op_table['i_'+ops[5]] !== 'undefined' ? op_table['i_'+ops[5]] : parseInt(ops[5], 16);
    if(isNaN(output) || output < 0) return;

    let mint;

    if(block < legacy_block_end)
    {
        if(isNaN(parseInt(hexToString(ops[6]))))
        {
            mint = ops[6];
        }
        else
        {
            mint = hexToString(ops[6]);
        }
    }
    else
    {
        mint = hexToString(ops[6]);
    }

    if( mint.startsWith('0') && !mint.startsWith('0.') ) return;
    if( mint.includes('.') && mint.endsWith('0') ) return;
    if( mint.endsWith('.') ) return;

    let deployment = await getDeployment(ticker, id);

    if(deployment !== null)
    {
        if(countDecimals(mint) > deployment.dec) return;

        deployment.lim = BigInt(deployment.lim);
        deployment.rem = BigInt(deployment.rem);

        mint = resolveNumberString(mint, deployment.dec);

        let _total_limit = BigInt('18446744073709551615');
        let _mint = BigInt(mint);

        if(_mint <= 0 || _mint > _total_limit) return;

        if(typeof res.vout[output] === 'undefined') return;
        let res_vout = Script.decode(res.vout[output].scriptPubKey, false);
        if(res_vout[0] === 'OP_RETURN') return;

        if(deployment.rem === 0n) return;
        if(_mint <= 0n || _mint > deployment.lim || deployment.lim > deployment.max) return;

        if(deployment.rem - _mint < 0n)
        {
            _mint = deployment.rem;
        }

        deployment.rem -= _mint;
        deployment.lim = deployment.lim.toString();
        deployment.rem = deployment.rem.toString();

        try
        {
            const to_address = Address.fromScriptPubKey(res.vout[output].scriptPubKey, network);
            const utxo = 'utxo_' + tx.txid + '_' + output;

            const _utxo = {
                addr : to_address,
                txid : tx.txid,
                vout : output,
                tick : deployment.tick,
                id : deployment.id,
                amt : _mint.toString()
            };

            await db.put(utxo, JSON.stringify(_utxo));
            await db.put('d_' + ticker + '_' + id, JSON.stringify(deployment));

            const address_amt = 'a_' + to_address + '_' + ticker + '_' + id;

            try
            {
                let amt = await db.get(address_amt);
                amt = BigInt(amt) + _mint;
                await db.put(address_amt, amt.toString());
            }
            catch(e)
            {
                await db.put(address_amt, _utxo.amt);
            }

            //console.log(await db.get(utxo));
        }
        catch(e)
        {
            console.log(e);
        }
    }
}

/**
 * Manages deployments for the selected ticker:id in the op_return it is processing.
 * This also includes collectible attachments (PIPE | Art) from the transaction's witness data.
 *
 * @param block
 * @param blockhash
 * @param vout
 * @param tx
 * @param res
 * @param ops
 * @param network
 * @returns {Promise<void>}
 */
async function indexDeployment(block, blockhash, vout, tx, res, ops, network = 'main')
{
    try
    {
        if(ops.length !== 9) return;

        const b26_int = parseInt(ops[3], 16);
        if(isNaN(b26_int)) return;

        const id = ops[4].startsWith('OP_') && typeof op_table['i_'+ops[4]] !== 'undefined' ? op_table['i_'+ops[4]] : parseInt(ops[4], 16);
        if(isNaN(id) || id < 0 || id > 999999) return;

        const output = ops[5].startsWith('OP_') && typeof op_table['i_'+ops[5]] !== 'undefined' ? op_table['i_'+ops[5]] : parseInt(ops[5], 16);
        if(isNaN(output) || output < 0) return;

        const decimals = ops[6].startsWith('OP_') && typeof op_table['i_'+ops[6]] !== 'undefined' ? op_table['i_'+ops[6]] : parseInt(ops[6], 16);
        if(isNaN(decimals) || decimals < 0 || decimals > 8) return;

        let hex = ops[3];
        let base = 10;
        let bn = BigInt('0x' + hex);
        let int_ticker = BigInt(bn.toString(base));

        const ticker = toString26(int_ticker);

        if(await getDeployment(ticker, id) !== null) return;

        let max = '';
        let limit = '';

        if(block < legacy_block_end)
        {
            if(isNaN(parseInt(hexToString(ops[7]))))
            {
                max = ops[7];
            }
            else
            {
                max = hexToString(ops[7]);
            }

            if(isNaN(parseInt(hexToString(ops[8]))))
            {
                limit = ops[8];
            }
            else
            {
                limit = hexToString(ops[8]);
            }
        }
        else
        {
            max = hexToString(ops[7]);
            limit = hexToString(ops[8]);
        }

        if( max.startsWith('0') && !max.startsWith('0.') ) return;
        if( max.includes('.') && max.endsWith('0') ) return;
        if( max.endsWith('.') ) return;
        if( limit.startsWith('0') && !limit.startsWith('0.') ) return;
        if( limit.includes('.') && limit.endsWith('0') ) return;
        if( limit.endsWith('.') ) return;

        if(countDecimals(max) > decimals) return;
        if(countDecimals(limit) > decimals) return;

        max = resolveNumberString(max, decimals);
        limit = resolveNumberString(limit, decimals);

        let _total_limit = BigInt('18446744073709551615');
        let _max = BigInt(max);
        let _limit = BigInt(limit);

        if(_max <= 0 || _max > _total_limit) return;
        if(_limit <= 0 || _limit > _total_limit) return;

        if(typeof res.vout[output] === 'undefined') return;
        let res_vout = Script.decode(res.vout[output].scriptPubKey, false);
        if(res_vout[0] === 'OP_RETURN') return;

        const to_address = Address.fromScriptPubKey(res.vout[output].scriptPubKey, network);

        let deployment = 'd_' + ticker + '_' + id;

        try
        {
            await db.get(deployment);
        }
        catch(e)
        {

            let collection_address = null;
            let collection_number = null;
            let mint_to_beneficiary = false;
            let mint_to_beneficiary_output = 0;
            let mint_to_beneficiary_to_address = null;

            for(let i = 0; i < tx.vin.length; i++)
            {
                if(tx.vin[i].txinwitness.length === 3)
                {
                    try
                    {
                        const decoded = Script.decode(tx.vin[i].txinwitness[1], false);

                        if(decoded.length >= 12 && decoded[4] === op_table.p && decoded[5] === op_table.a)
                        {
                            if(decoded[6] !== op_table.i && decoded[6] !== op_table.r)
                            {
                                return;
                            }

                            let mime = null;
                            let ref = null;

                            if(decoded[6] === op_table.i)
                            {
                                try
                                {
                                    mime = hexToString(decoded[7]);
                                    const bytes = hexToBytes(decoded[8]);

                                    if(bytes.length === 0 || bytes[0] === 0)
                                    {
                                        return;
                                    }
                                }
                                catch(e)
                                {
                                    return;
                                }
                            }
                            else if(decoded[6] === op_table.r)
                            {
                                ref = new TextDecoder().decode(hexToBytes(decoded[8]));

                                if(ref === '' || ref.includes('\x00') || ref === 'OP_0')
                                {
                                    return;
                                }

                                if(decoded[9] !== op_table.n)
                                {
                                    return;
                                }
                            }
                            else
                            {
                                return;
                            }

                            let number_position = 0;

                            for(let j = 0; j < decoded.length; j++)
                            {
                                if(decoded[j] === op_table.n){
                                    number_position = j;
                                    break;
                                }
                            }

                            if(
                                number_position === 0 ||
                                (
                                    number_position !== 0 &&
                                    ( typeof decoded[number_position+1] === 'undefined' || typeof decoded[number_position+2] === 'undefined' )
                                )
                            )
                            {
                                return;
                            }

                            let num1 = decoded[number_position+1];
                            num1 = num1.startsWith('OP_') && typeof op_table['i_'+num1] !== 'undefined' ? op_table['i_'+num1] : parseInt(num1, 16);

                            let num2 = decoded[number_position+2];
                            num2 = num2.startsWith('OP_') && typeof op_table['i_'+num2] !== 'undefined' ? op_table['i_'+num2] : parseInt(num2, 16);

                            if(isNaN(num1) || isNaN(num2) || num1 < 0 || num1 > num2 || num1 > 999_999_999 || num2 > 999_999_999) return;

                            if(typeof decoded[number_position+3] !== 'undefined' &&
                                decoded[number_position+3] === op_table.b &&
                                typeof decoded[number_position+4] !== 'undefined' &&
                                decoded[number_position+4] !== 'OP_0')
                            {
                                mint_to_beneficiary = true;
                                mint_to_beneficiary_output = decoded[number_position+4].startsWith('OP_') && typeof op_table['i_'+decoded[number_position+4]] !== 'undefined' ? op_table['i_'+decoded[number_position+4]] : parseInt(decoded[number_position+4], 16);
                                mint_to_beneficiary_output -= 1;
                                if(isNaN(mint_to_beneficiary_output) || mint_to_beneficiary_output < 0) return;
                                if(typeof res.vout[mint_to_beneficiary_output] === 'undefined') return;
                                let mint_to_decoded = Script.decode(res.vout[mint_to_beneficiary_output].scriptPubKey, false);
                                if(mint_to_decoded[0] === 'OP_RETURN') return;
                                mint_to_beneficiary_to_address = Address.fromScriptPubKey(res.vout[mint_to_beneficiary_output].scriptPubKey, network);
                            }
                            else if(typeof decoded[number_position+3] !== 'undefined' &&
                                decoded[number_position+3] !== op_table.b)
                            {
                                return;
                            }

                            let traits = null;

                            if(typeof decoded[number_position+5] !== 'undefined' &&
                                op_table.t === decoded[number_position+5])
                            {
                                traits = [];

                                for(let j = number_position+6; j < decoded.length - 2; j++)
                                {
                                    const trait = new TextDecoder().decode(hexToBytes(decoded[j]));

                                    if(trait === '' || trait.includes('\x00') || decoded[j] === 'OP_0')
                                    {
                                        return;
                                    }

                                    traits.push(trait);
                                }

                                if(traits.length % 2 !== 0)
                                {
                                    return;
                                }
                            }
                            else if(typeof decoded[number_position+5] !== 'undefined' &&
                                op_table.tr === decoded[number_position+5])
                            {
                                if(typeof decoded[number_position+4] === 'undefined')
                                {
                                    return;
                                }

                                traits = new TextDecoder().decode(hexToBytes(decoded[number_position+6]));

                                if(traits === '' || traits.includes('\x00') || traits === 'OP_0')
                                {
                                    return;
                                }
                            }

                            if(decoded[1] !== 'OP_CHECKSIG' ||
                                typeof decoded[decoded.length - 1] === 'undefined' || decoded[decoded.length - 1] !== 'OP_ENDIF'
                            )
                            {
                                return;
                            }

                            // must be a taproot address
                            collection_address = Address.fromScriptPubKey(['OP_1', decoded[0]], network);

                            try
                            {
                                await db.get('c_' + collection_address + '_' + num1);
                                // not throwing, exists already
                                return;
                            }
                            catch(e)
                            {
                                let c_max = 0;

                                try
                                {
                                    c_max = await db.get('c_max_' + collection_address);

                                    if(num2 > c_max)
                                    {
                                        c_max = num2;
                                        await db.put('c_max_' + collection_address, num2);
                                    }
                                }
                                catch(e)
                                {
                                    c_max = num2;
                                    await db.put('c_max_' + collection_address, num2);
                                }

                                collection_number = num1;

                                await db.put('c_' + collection_address + '_' + num1, JSON.stringify({
                                    tick : ticker,
                                    id : id,
                                    col : collection_address,
                                    num : num1,
                                    traits : traits,
                                    mime : mime,
                                    ref : ref
                                }));

                                /*
                                console.log({
                                    tick : ticker,
                                    id : id,
                                    col : collection_address,
                                    num : num1,
                                    traits : traits,
                                    mime : mime,
                                    ref : ref
                                });*/
                            }

                            break;
                        }
                    }
                    catch(e) {}
                }
            }

            let _deployment = {
                tick : ticker,
                id : id,
                dec : decimals,
                max : max,
                lim : limit,
                rem : max,
                tx : tx.txid,
                vo : vout,
                bvo : output,
                baddr : to_address,
                col : collection_address,
                colnum : collection_number,
                blck : block,
                blckh : blockhash
            };

            if(mint_to_beneficiary)
            {
                let d = _deployment;
                d.lim = BigInt(d.lim);
                d.rem = BigInt(d.rem);
                d.max = BigInt(d.max);

                let mint = d.lim;

                let _total_limit = BigInt('18446744073709551615');
                let _mint = BigInt(mint);

                if(_mint <= 0 || _mint > _total_limit) return;

                if(typeof res.vout[mint_to_beneficiary_output] === 'undefined') return;

                if(d.rem === 0n) return;
                if(_mint <= 0n || _mint > d.lim || d.lim > d.max) return;

                if(d.rem - _mint < 0n)
                {
                    _mint = d.rem;
                }

                d.rem -= _mint;

                try
                {
                    const utxo = 'utxo_' + tx.txid + '_' + mint_to_beneficiary_output;

                    const _utxo = {
                        addr : mint_to_beneficiary_to_address,
                        txid : tx.txid,
                        vout : mint_to_beneficiary_output,
                        tick : ticker,
                        id : id,
                        amt : _mint.toString()
                    };

                    d.lim = d.lim.toString();
                    d.rem = d.rem.toString();
                    d.max = d.max.toString();

                    await db.put(utxo, JSON.stringify(_utxo));
                    await db.put('d_' + ticker + '_' + id, JSON.stringify(d));

                    const address_amt = 'a_' + mint_to_beneficiary_to_address + '_' + ticker + '_' + id;

                    try
                    {
                        let amt = await db.get(address_amt);
                        amt = BigInt(amt) + _mint;
                        await db.put(address_amt, amt.toString());
                    }
                    catch(e)
                    {
                        await db.put(address_amt, _utxo.amt);
                    }

                    _deployment.rem = d.rem.toString();

                    //console.log(await db.get(utxo));
                }
                catch(e)
                {
                    console.log(e);
                }
            }

            await db.put(deployment, JSON.stringify(_deployment));
            await db.put('da_' + to_address + '_' + ticker + '_' + id, deployment);

            //console.log(await db.get(deployment));
        }
    }
    catch(e){}
}

/**
 * Sends tokens to a recipient.
 *
 * @param name
 * @param to
 * @param ticker
 * @param id
 * @param amount
 * @param rate
 * @param max_fee
 * @param network
 * @returns {Promise<string>}
 */
async function sendTokens(name, to, ticker, id, amount, rate, max_fee = 0, use_change_address = null, network = 'main')
{
    ticker = ticker.trim().toLowerCase();
    id = parseInt(id.trim());

    const deployment = await getDeployment(ticker, id);

    if(deployment === null)
    {
        throw new Error('Token not found');
    }

    amount = BigInt(resolveNumberString(amount, deployment.dec));
    rate = BigInt(''+rate);

    try
    {
        try
        {
            await exe(btc_cli_path + ' unloadwallet ' + name);
        }  catch(f) {}

        await exe(btc_cli_path + ' loadwallet '+name);

        const unspent_result = await exe(btc_cli_path + ' -rpcwallet='+name+' listunspent', { maxBuffer: 1024 * 1024 * 10000 });
        const utxos = JSON.parse(unspent_result.trim());

        let vin = [];
        let found = 0n;
        let sats_found = 0n;
        let sats_amount = 1092n;
        let change_address = null;

        for(let i = 0; i < utxos.length; i++)
        {
            if(found >= amount * 2n)
            {
                break;
            }

            if(
                utxos[i].confirmations > 0 &&
                utxos[i].spendable &&
                utxos[i].solvable &&
                utxos[i].safe
            )
            {
                const utxo = 'utxo_' + utxos[i].txid + '_' + utxos[i].vout;

                try
                {
                    let _utxo = await db.get(utxo);
                    _utxo = JSON.parse(_utxo);

                    if(_utxo.tick === ticker && _utxo.id === id)
                    {
                        vin.push({
                            txid: utxos[i].txid,
                            vout: utxos[i].vout,
                            prevout: {
                                value: BigInt(resolveNumberString(''+utxos[i].amount, 8)),
                                scriptPubKey: await addressToScriptPubKey(utxos[i].address, network)
                            }
                        });

                        found += BigInt(_utxo.amt);
                    }
                }
                catch(e) {}
            }
        }

        for(let i = 0; i < utxos.length; i++)
        {
            if(sats_found >= sats_amount * rate)
            {
                break;
            }

            let token_utxo_exists = false;

            try
            {
                const utxo = 'utxo_' + utxos[i].txid + '_' + utxos[i].vout;
                await db.get(utxo);
                token_utxo_exists = true;
                console.log('exists', utxo);

            } catch(e){}

            if(
                !token_utxo_exists &&
                utxos[i].confirmations > 0 &&
                utxos[i].spendable &&
                utxos[i].solvable &&
                utxos[i].safe
            )
            {
                vin.push({
                    txid: utxos[i].txid,
                    vout: utxos[i].vout,
                    prevout: {
                        value: BigInt(resolveNumberString(''+utxos[i].amount, 8)),
                        scriptPubKey: await addressToScriptPubKey(utxos[i].address, network)
                    }
                });

                sats_found += BigInt(resolveNumberString(''+utxos[i].amount, 8));
            }
        }

        if(found < amount)
        {
            throw new Error('Insufficient token funds');
        }

        let vout = [];

        vout.push({
            value: 546n,
            scriptPubKey: await addressToScriptPubKey(to, network)
        });

        let addr_result;

        if(use_change_address === null)
        {
            addr_result = await createAddress(name, false);
            addr_result = JSON.parse(addr_result.trim());
            change_address = addr_result.address;
        }
        else
        {
            change_address = use_change_address;
        }

        const ec = new TextEncoder();
        let conv_amount = cleanFloat(formatNumberString(amount.toString(), deployment.dec));
        const token_change = found - amount;

        if(token_change <= 0n)
        {
            vout.push({
                scriptPubKey: [ 'OP_RETURN', ec.encode('P'), ec.encode('T'),
                    toBytes(toInt26(ticker)), toBytes(BigInt(id)), toBytes(0n), textToHex(conv_amount)
                ]
            });
        }
        else
        {
            let conv_change = cleanFloat(formatNumberString(token_change.toString(), deployment.dec));

            vout.push({
                value: 546n,
                scriptPubKey: await addressToScriptPubKey(change_address, network)
            });

            vout.push({
                scriptPubKey: [ 'OP_RETURN', ec.encode('P'), ec.encode('T'),
                    toBytes(toInt26(ticker)), toBytes(BigInt(id)), toBytes(0n), textToHex(conv_amount),
                    toBytes(toInt26(ticker)), toBytes(BigInt(id)), toBytes(1n), textToHex(conv_change)
                ]
            });
        }

        const txdata = Tx.create({
            vin  : vin,
            vout : vout
        });

        if(use_change_address === null)
        {
            addr_result = await createAddress(name, false);
            addr_result = JSON.parse(addr_result.trim());
            change_address = addr_result.address;
        }

        const hex = Tx.encode(txdata).hex;

        let fund_result;

        if(isWindows())
        {
            fund_result = await exe(btc_cli_path + " -rpcwallet=" + name + " fundrawtransaction \"" + hex + "\" {\\\"add_inputs\\\":false,\\\"changeAddress\\\":\\\"" + change_address + "\\\",\\\"changePosition\\\":" + (vout.length) + ",\\\"fee_rate\\\":" + (rate.toString()) + ",\\\"includeWatching\\\":false}");
        }
        else
        {
            fund_result = await exe(btc_cli_path + " -rpcwallet=" + name + ' fundrawtransaction "' + hex + '" \'{"add_inputs":false,"changeAddress":"' + change_address + '","changePosition":' + (vout.length) + ',"fee_rate":' + (rate.toString()) + ',"includeWatching":false}\'');
        }

        fund_result = JSON.parse(fund_result.trim());

        let sign_result = await exe(btc_cli_path + ' -rpcwallet='+name+' signrawtransactionwithwallet  "'+fund_result.hex+'"');
        sign_result = JSON.parse(sign_result.trim());

        let broadcast_result = await exe(btc_cli_path + ' sendrawtransaction "'+sign_result.hex+'" ' + max_fee);
        broadcast_result = broadcast_result.trim();

        const result = {
            error : false,
            txid : broadcast_result,
            amount : amount.toString()
        };

        return JSON.stringify(result);
    }
    catch(e)
    {
        const result = {
            error : true,
            message : e.message
        };

        return JSON.stringify(result);
    }
}

/**
 * Sends sats to a recipient.
 * Please do not use floats, indicating a BTC amount.
 *
 * @param name
 * @param to
 * @param amount
 * @param rate
 * @param max_fee
 * @param network
 * @returns {Promise<string>}
 */
async function sendSats(name, to, amount, rate, max_fee = 0, use_change_address = null, network = 'main')
{
    amount = BigInt(''+amount);
    rate = BigInt(''+rate);

    try
    {
        try
        {
            await exe(btc_cli_path + ' unloadwallet ' + name);
        }  catch(f) {}

        await exe(btc_cli_path + ' loadwallet '+name);

        const unspent_result = await exe(btc_cli_path + ' -rpcwallet='+name+' listunspent', { maxBuffer: 1024 * 1024 * 10000 });
        const utxos = JSON.parse(unspent_result.trim());

        let vin = [];
        let found = 0n;
        let change_address = null;

        for(let i = 0; i < utxos.length; i++)
        {
            if(found >= amount * rate * 2n)
            {
                break;
            }

            let token_utxo_exists = false;

            try
            {
                const utxo = 'utxo_' + utxos[i].txid + '_' + utxos[i].vout;
                await db.get(utxo);
                token_utxo_exists = true;
                console.log('exists', utxo);

            } catch(e){}

            if(
                !token_utxo_exists &&
                utxos[i].confirmations > 0 &&
                utxos[i].spendable &&
                utxos[i].solvable &&
                utxos[i].safe
            )
            {
                vin.push({
                    txid: utxos[i].txid,
                    vout: utxos[i].vout,
                    prevout: {
                        value: BigInt(resolveNumberString(''+utxos[i].amount, 8)),
                        scriptPubKey: await addressToScriptPubKey(utxos[i].address, network)
                    }
                });

                found += BigInt(resolveNumberString(''+utxos[i].amount, 8));
            }
        }

        let vout = [];

        vout.push({
            value: amount,
            scriptPubKey: await addressToScriptPubKey(to, network)
        });

        const txdata = Tx.create({
            vin  : vin,
            vout : vout
        });

        const hex = Tx.encode(txdata).hex;

        let addr_result;

        if(use_change_address === null)
        {
            addr_result = await createAddress(name, false);
            addr_result = JSON.parse(addr_result.trim());
            change_address = addr_result.address;
        }
        else
        {
            change_address = use_change_address;
        }

        let fund_result;

        if(isWindows())
        {
            fund_result = await exe(btc_cli_path + " -rpcwallet=" + name + " fundrawtransaction \"" + hex + "\" {\\\"add_inputs\\\":false,\\\"changeAddress\\\":\\\"" + change_address + "\\\",\\\"changePosition\\\":1,\\\"fee_rate\\\":" + (rate.toString()) + ",\\\"includeWatching\\\":false}");
        }
        else
        {
            fund_result = await exe(btc_cli_path + " -rpcwallet=" + name + ' fundrawtransaction "' + hex + '" \'{"add_inputs":false,"changeAddress":"' + change_address + '","changePosition":1,"fee_rate":' + (rate.toString()) + ',"includeWatching":false}\'');
        }

        fund_result = JSON.parse(fund_result.trim());

        let sign_result = await exe(btc_cli_path + ' -rpcwallet='+name+' signrawtransactionwithwallet  "'+fund_result.hex+'"');
        sign_result = JSON.parse(sign_result.trim());

        let broadcast_result = await exe(btc_cli_path + ' sendrawtransaction "'+sign_result.hex+'" ' + max_fee);
        broadcast_result = broadcast_result.trim();

        const result = {
            error : false,
            txid : broadcast_result,
            amount : amount.toString()
        };

        return JSON.stringify(result);
    }
    catch(e)
    {
        const result = {
            error : true,
            message : e.message
        };

        return JSON.stringify(result);
    }
}

///////////////////////////////////
// HELPER FUNCTIONS
/////////////////////////////////////////////

async function isSegwitAddress(to)
{
    if(to.startsWith('tb1q') || to.startsWith('bc1q'))
    {
        return true;
    }
    else if(to.startsWith('tb1p') || to.startsWith('bc1p'))
    {
        return true;
    }

    return false;
}

async function addressToScriptPubKey(to, network)
{
    let _toAddress, _script;

    if(to.startsWith('tb1q') || to.startsWith('bc1q'))
    {
        _toAddress = Address.p2wpkh.decode(to, network).hex;
        _script = [ 'OP_0', _toAddress ];
    }
    else if(to.startsWith('1') || to.startsWith('m') || to.startsWith('n'))
    {
        _toAddress = Address.p2pkh.decode(to, network).hex;
        _script = Address.p2pkh.scriptPubKey(_toAddress);
    }
    else if(to.startsWith('3') || to.startsWith('2'))
    {
        _toAddress = Address.p2sh.decode(to, network).hex;
        _script = Address.p2sh.scriptPubKey(_toAddress);
    }
    else
    {
        _toAddress = Address.p2tr.decode(to, network).hex;
        _script = [ 'OP_1', _toAddress ];
    }

    return _script;
}

async function createWallet(name, restore = false, phrase = null, derivation_path = null, network = 'main')
{
    try
    {
        const network_main = {
            messagePrefix: '\x18Bitcoin Signed Message:\n',
            bech32: 'bc',
            bip32: {
                public: 0x0488b21e,
                private: 0x0488ade4,
            },
            pubKeyHash: 0x00,
            scriptHash: 0x05,
            wif: 0x80
        };

        const network_testnet = {
            messagePrefix: '\x18Bitcoin Signed Message:\n',
            bech32: 'tb',
            bip32: {
                public: 0x043587cf,
                private: 0x04358394,
            },
            pubKeyHash: 0x6f,
            scriptHash: 0xc4,
            wif: 0xef
        };

        const networks = {
            'main' : network_main,
            'testnet' : network_testnet
        }

        let path = `m/86'/0'/0'`;

        if(derivation_path !== null)
        {
            path = derivation_path;
        }
        else
        {
            if(network === 'testnet')
            {
                path = `m/49'/1'/0'/0`;
            }
        }

        bip39.setDefaultWordlist('english');

        let mnemonic;

        if(!restore)
        {
            mnemonic = bip39.generateMnemonic();
        }
        else
        {
            mnemonic = phrase;
        }

        const seed = bip39.mnemonicToSeedSync(mnemonic);
        let root = bip32.fromSeed(seed, networks[network]);
        let account = root.derivePath(path);

        const desc_result = await exe(btc_cli_path + ' getdescriptorinfo "tr(' + account.toBase58() + '/0/*)"');
        const desc_result2 = JSON.parse(desc_result.trim());

        await exe(btc_cli_path + ' -named createwallet wallet_name='+name+' descriptors=true');

        if(isWindows())
        {
            await exe(btc_cli_path + " -rpcwallet="+name+" importdescriptors [{\\\"desc\\\":\\\"tr("+account.toBase58()+"/0/*)#"+desc_result2.checksum+"\\\",\\\"timestamp\\\":\\\"now\\\",\\\"active\\\":true,\\\"internal\\\":false}]");
        }
        else
        {
            await exe(btc_cli_path + " -rpcwallet="+name+' importdescriptors \'[{"desc":"tr('+account.toBase58()+'/0/*)#'+desc_result2.checksum+'","timestamp":"now","active":true,"internal":false}]\'');
        }

        let addr_result = await createAddress(name, false);
        addr_result = JSON.parse(addr_result.trim());

        const result = {
            addr_result : addr_result,
            error : false,
            mnemonic : mnemonic,
            privkey : account.toBase58(),
            pubkey : account.neutered().toBase58(),
            wif : account.toWIF()
        };

        return JSON.stringify(result);
    }
    catch(e)
    {
        const result = {
            error : true,
            message : e.message
        };

        return JSON.stringify(result);
    }
}

async function createAddress(name, load = true)
{
    try
    {
        if(load)
        {
            try
            {
                await exe(btc_cli_path + ' unloadwallet ' + name);
            }  catch(f) {}

            await exe(btc_cli_path + ' loadwallet '+name);
        }

        const address = await exe(btc_cli_path + ' -rpcwallet='+name+' getnewaddress -addresstype bech32m');

        const result = {
            error : false,
            address : address.trim()
        };

        return JSON.stringify(result);
    }
    catch(e)
    {
        if(load)
        {
            try
            {
                await exe(btc_cli_path + ' unloadwallet ' + name);
            }
            catch (f) {}
        }

        const result = {
            error : true,
            message : e.message
        };

        return JSON.stringify(result);
    }
}

function decodeAddress(toAddress, encodedAddressPrefix) {

    if(toAddress.startsWith('tb1q') || toAddress.startsWith('bc1q'))
    {
        return Address.p2wpkh.decode(toAddress).hex;
    }
    else if(toAddress.startsWith('1') || toAddress.startsWith('m') || toAddress.startsWith('n'))
    {
        return Address.p2pkh.decode(toAddress, encodedAddressPrefix).hex;
    }
    else if(toAddress.startsWith('3') || toAddress.startsWith('2'))
    {
        return Address.p2sh.decode(toAddress, encodedAddressPrefix).hex;
    }

    return Address.p2tr.decode(toAddress).hex;
}

function isWindows() {
    return Os.platform() === 'win32'
}

function exe(cmd, options) {
    return new Promise((resolve, reject) => {
        exec(cmd, options, (error, stdout, stderr) => {
            if (error) return reject(error)
            if (stderr) return reject(stderr)
            resolve(stdout)
        })
    })
}

async function getChainBlock()
{
    try
    {
        let info = await exe(btc_cli_path + ' getblockchaininfo', { maxBuffer: 1024 * 1024 * 10000 });
        info = JSON.parse(info.trim());

        return info.blocks;
    }
    catch(e) {}

    return 0;
}

async function mustIndex()
{
    let chain_block = await getChainBlock();

    if(chain_block > block)
    {
        return true;
    }

    return false;
}
function cleanFloat(input) {
    // Check if the input contains a comma and remove it
    input = input.replace(/,/g, '');

    // Regular expression to match and clean the float format with optional trailing zeros and an optional decimal point
    const regex = /^0*(\d+)\.?(\d*?)0*$/;

    // Check if the input matches the regex pattern
    const match = input.match(regex);

    // If there's a match, return the cleaned float, otherwise return "0"
    if (match) {
        const integerPart = match[1];
        const decimalPart = match[2] || '';
        return decimalPart ? `${integerPart}.${decimalPart}` : integerPart;
    } else {
        throw new Error('Invalid float to clean');
    }
}


function isValidNumber(strNum)
{
    let validNumber = new RegExp(/^\d*\.?\d*$/);
    return validNumber.test(''+strNum);
}

function formatNumberString(string, decimals) {

    let pos = string.length - decimals;

    if(decimals == 0) {
        // nothing
    }else
    if(pos > 0){
        string = string.substring(0, pos) + "." + string.substring(pos, string.length);
    }else{
        string = '0.' + ( "0".repeat( decimals - string.length ) ) + string;
    }

    return string;
}

function resolveNumberString(number, decimals){

    if(!isValidNumber(number))
    {
        //console.log('Invalid number', number);
        throw new Error('Invalid op number');
    }

    let splitted = number.split(".");
    if(splitted.length == 1 && decimals > 0){
        splitted[1] = '';
    }
    if(splitted.length > 1) {
        let size = decimals - splitted[1].length;
        for (let i = 0; i < size; i++) {
            splitted[1] += "0";
        }
        let new_splitted = '';
        for(let i = 0; i < splitted[1].length; i++)
        {
            if(i >= decimals)
            {
                break;
            }
            new_splitted += splitted[1][i];
        }
        number = "" + (splitted[0] == '0' ? '' : splitted[0]) + new_splitted;
        if(BigInt(number) == 0n || number === ''){
            number = "0";
        }
    }

    try {

        while (number.charAt(0) === '0') {
            number = number.substring(1);
        }

    }catch(e){

        number = '0';
    }

    return number === '' ? '0' : number;
}

function textToHex(text) {
    var encoder = new TextEncoder().encode(text);
    return [...new Uint8Array(encoder)]
        .map(x => x.toString(16).padStart(2, "0"))
        .join("");
}

function hexToString(hex){
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
        const hexValue = hex.substring(i, i+2);
        const decimalValue = parseInt(hexValue, 16);
        str += String.fromCharCode(decimalValue);
    }
    return str;
}

function hexToBytes(hex) {
    return Uint8Array.from(hex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
}

function isHex(value)
{
    return typeof value === 'string' &&
        value.length % 2 === 0  &&
        /[0-9a-fA-F]/.test(value)
}

function toString26(num) {
    var alpha = charRange('a', 'z');
    var result = '';

    // no letters for 0 or less
    if (num < 1) {
        return result;
    }

    var quotient = num,
        remainder;

    // until we have a 0 quotient
    while (quotient !== 0n) {
        // compensate for 0 based array
        var decremented = quotient - 1n;

        // divide by 26
        quotient = decremented / 26n;

        // get remainder
        remainder = decremented % 26n;

        // prepend the letter at index of remainder
        result = alpha[remainder] + result;
    }

    return result;
}

function bitLength(number) {
    if (typeof number !== 'bigint') {
        throw new Error("Input must be a BigInt");
    }
    return number === 0n ? 0 : number.toString(2).length;
}

function byteLength(number) {
    if (typeof number !== 'bigint') {
        throw new Error("Input must be a BigInt");
    }
    return Math.ceil(bitLength(number) / 8);
}

function fromBytes(buffer) {
    const bytes = new Uint8Array(buffer);
    const size = bytes.byteLength;
    let x = 0n;
    for (let i = 0; i < size; i++) {
        const byte = BigInt(bytes[i]);
        x = (x << 8n) | byte;
    }
    return x;
}

function toBytes(number) {
    if (typeof number !== 'bigint') {
        throw new Error("Input must be a BigInt");
    }

    if (number < 0n) {
        throw new Error("BigInt must be non-negative");
    }

    if (number === 0n) {
        return new Uint8Array().buffer;
    }

    const size = byteLength(number);
    const bytes = new Uint8Array(size);
    let x = number;
    for (let i = size - 1; i >= 0; i--) {
        bytes[i] = Number(x & 0xFFn);
        x >>= 8n;
    }

    return bytes.buffer;
}

function toInt26(str) {
    var alpha = charRange('a', 'z');
    var result = 0n;

    // make sure we have a usable string
    str = str.toLowerCase();
    str = str.replace(/[^a-z]/g, '');

    // we're incrementing j and decrementing i
    var j = 0n;
    for (var i = str.length - 1; i > -1; i--) {
        // get letters in reverse
        var char = str[i];

        // get index in alpha and compensate for
        // 0 based array
        var position = BigInt(''+alpha.indexOf(char));
        position++;

        // the power kinda like the 10's or 100's
        // etc... position of the letter
        // when j is 0 it's 1s
        // when j is 1 it's 10s
        // etc...
        const pow = (base, exponent) => base ** exponent;

        var power = pow(26n, j)

        // add the power and index to result
        result += power * position;
        j++;
    }

    return result;
}

function charRange(start, stop) {
    var result = [];

    // get all chars from starting char
    // to ending char
    var i = start.charCodeAt(0),
        last = stop.charCodeAt(0) + 1;
    for (i; i < last; i++) {
        result.push(String.fromCharCode(i));
    }

    return result;
}

function countDecimals(value){
    const num = value.split('.');
    return num[1] ? num[1].length : 0;
}

function sleep(ms) {

    return new Promise(resolve => setTimeout(resolve, ms));
}