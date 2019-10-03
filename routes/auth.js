const utils = require("../bin/utils");

var express = require('express');
const sc2 = require('sc2-sdk');
const config = require("../bin/config");
const db = config.db;
var router = express.Router();

const dsteem = require('dsteem');
const steem = require('steem');
const client = new dsteem.Client('https://api.steemit.com');

const bodyParser = require('body-parser');
const urlencodedParser = bodyParser.urlencoded({limit: '500kb', extended: true});
const sanitize = require("xss");

const encryptionHelper = require("../bin/encryptionhelper.js");
const algorithm = encryptionHelper.CIPHERS.AES_256;

function makeid(nb) {
    let text = "";
    const possible = "abcdefghijklmnopqrstuvwxyz0123456789";

    for (let i = 0; i < nb; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}


function get_encryption_data(iv)
{
    return new Promise(async resolve => {
        let encryption_data = await encryptionHelper.getKeyAndIV(process.env.ENCRYPTION_PW);
        if (iv) {
            iv = iv.split(",").map(Number);
            const buf = Buffer.from(iv);
            const vue = new Uint8Array(buf);
            encryption_data['iv'] = vue;
            return resolve(encryption_data);
        }
        else
            return resolve(encryption_data);
    });
}

function encrypt (text, initialisation_vector) {
    return new Promise(async resolve => {
        let data;
        let iv;
        if (initialisation_vector) {
            data = await get_encryption_data(initialisation_vector);
            iv = initialisation_vector;
        }
        else {
            data = await get_encryption_data();
            let json_iv = JSON.stringify(data['iv']);
            json_iv = JSON.parse(json_iv);

            if (!json_iv.data)
                console.log(json_iv);

            iv  = json_iv.data.toString();
        }
        const encText = encryptionHelper.encryptText(algorithm, data.key, data.iv, text, "hex");


        return resolve({encrypted : encText, iv : iv});
    });
}

function decrypt (encText, iv) {
    return new Promise(async resolve => {
        const data = await get_encryption_data(iv);

        const decText = encryptionHelper.decryptText(algorithm, data.key, data.iv, encText, "hex");
        return resolve(decText);
    });
}

router.get('/',  function(req, res, next) {

    // init steemconnect
    let api = sc2.Initialize({
        app: config.account_username,
        callbackURL: req.app.get('env') === 'development' ? 'http://localhost:4002/auth/conf' : "https://back.downvotecontrol.com/auth/conf",
        scope: ['login','vote'],
    });

    // get login URL
    let link = api.getLoginURL();
    return res.redirect(301, link);
});

router.post('/keychain/fetch_memo', async function(req, res, next) {
    const username = sanitize(req.body.username);

    if (username && username.length < 16 && username.length > 3) {
        let data = await client.database.getAccounts([username]);
        let pub_key = data[0].posting.key_auths[0][0];

        if (data.length === 1)
        {
            let user = await db("SELECT * from user_login where username = ?", username);
            let encoded_message = "";
            if (user.length === 0) {

                let {encrypted, iv} = await encrypt(username);

                encrypted = "#"+encrypted;

                encoded_message = steem.memo.encode(process.env.WIF, pub_key, encrypted);

                await db("INSERT INTO user_login(username, encrypted_username, iv, token) VALUES(?,?,?,'')", [username, encrypted, iv]);
                res.send({status : "ok", message : encoded_message});
            } else
            {
                // We recalculate each time in case the user has changed it's keys
                encoded_message = steem.memo.encode(process.env.WIF, pub_key, user[0].encrypted_username);
                res.send({status : "ok", message : encoded_message});
            }

        } else
        {
            res.send({status : "ko"});
        }
    }
});


router.post('/keychain/login', async function(req, res, next) {
    const username = sanitize(req.body.username);
    let encrypted_username = sanitize(req.body.encrypted_username);

    if (username && encrypted_username && username.length < 16 && username.length > 3) {

        let user = await db("SELECT * from user_login where username = ?", username);
        if (user.length === 1 && user[0].encrypted_username === encrypted_username)
        {
            // Remove leading #
            encrypted_username = encrypted_username.substr(1);
            let username_decrypted = await decrypt(encrypted_username, user[0].iv);

            if (username_decrypted === username) {

                let token = makeid(40);
                await db("UPDATE user_login set token = ? WHERE username = ?", [token, username]);

                let account = {
                    username,
                    token
                };

                let data = await db("SELECT * FROM user_data WHERE username = ?", [username]);

                if (data.length === 0) {
                    await db("INSERT INTO user_data(username, dv_threshold, vp_threshold, min_payout) VALUES(?,80, 95, 0)", [username]);
                    account.vp_threshold = 95;
                    account.dv_threshold = 80;
                    account.min_payout = 0;
                } else {
                    account.vp_threshold = data[0].vp_threshold;
                    account.dv_threshold = data[0].dv_threshold;
                    account.min_payout = data[0].min_payout;
                }

                return res.send({status: "ok", account});
            }
        }

        return res.send({status : "ko"});
    }
});



router.post('/user',urlencodedParser, async function(req, res, next) {

    const username = sanitize(req.body.username);
    const token = sanitize(req.body.token);
    const type = sanitize(req.body.type);

    if (username && token && type) {

        let valid = await utils.valid_login(username, token, type);

        if (valid === true) {

            let data = await db("SELECT * FROM user_data WHERE username = ?", [username]);

            data = data[0];

            return res.send({status : "ok", dv_threshold : data.dv_threshold, vp_threshold : data.vp_threshold, min_payout : data.min_payout});
        } else
            return res.send({status : "ko"});
    }

    return res.send({status : "ko", data : "no_infos"});
});



router.get('/conf',async function(req, res, next) {

    const username = sanitize(req.query.username);
    const access_token = sanitize(req.query.access_token);

    if (username && access_token) {

        const valid = await utils.sc_valid(username, access_token);

        if (valid[0] === true) {

            let account = {
                username,
            };

            let data = await db("SELECT * FROM user_data WHERE username = ?", [username]);

            if (data.length === 0) {
                await db("INSERT INTO user_data(username, dv_threshold, vp_threshold, min_payout) VALUES(?,80, 95, 0)", [username]);
                account.vp_threshold = 95;
                account.dv_threshold = 80;
                account.min_payout = 0;
            } else {
                account.vp_threshold = data[0].vp_threshold;
                account.dv_threshold = data[0].dv_threshold;
                account.min_payout = data[0].min_payout;
            }

            account.token = access_token;
            return res.send("<script> window.opener.postMessage('"+JSON.stringify(account)+"',\"*\"); window.close()</script>");
        }
    }

    return res.send("An error occured, please try again");
});



router.post('/logout',urlencodedParser, async function(req, res, next) {

    const username = sanitize(req.body.username);
    const token = sanitize(req.body.token);
    const type = sanitize(req.body.type);

    if (username && token && type) {

        let valid = await utils.valid_login(username, token, type);

        if (valid === true) {

            if (type === "keychain")
            {
                db("DELETE FROM user_login where username = ? AND token = ?", [username, token])
            } else {
                let api = sc2.Initialize({
                    app: config.account_username,
                    accessToken: token
                });

                api.revokeToken(function (err) {
                    if (err)
                        console.error(err);
                });
            }

            return res.send("ok");

        }
    }
});



module.exports = router;