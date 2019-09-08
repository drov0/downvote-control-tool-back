const utils = require("../bin/utils");

var express = require('express');
const sc2 = require('sc2-sdk');
const config = require("../bin/config");
const db = config.db;
var router = express.Router();

const dsteem = require('dsteem');
const client = new dsteem.Client('https://api.steemit.com');

const bodyParser = require('body-parser');
const urlencodedParser = bodyParser.urlencoded({limit: '500kb', extended: true});
const sanitize = require("xss");


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



router.post('/user',urlencodedParser, async function(req, res, next) {

    const username = sanitize(req.body.username);
    const token = sanitize(req.body.token);

    if (username && token) {

        const valid = await utils.sc_valid(username, token);

        if (valid[0] === true) {


            let data = await db("SELECT * FROM user_data WHERE username = ?", [username]);

            data = data[0];

            return res.send({status : "ok", threshold : data.threshold, min_payout : data.min_payout});
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
                await db("INSERT INTO user_data(username, threshold, min_payout) VALUES(?,80, 0)", [username]);
                account.threshold = 80;
                account.min_payout = 0;
            } else {
                account.threshold =  data[0].threshold;
                account.min_payout =  data[0].min_payout;
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

    if (username && token) {

        const valid = await utils.sc_valid(username, token);

        if (valid[0] === true) {


            let api = sc2.Initialize({
                app: config.account_username,
                accessToken: token
            });

            api.revokeToken(function (err) {
                if (err)
                    console.error(err);
            });

            return res.send("ok");

        }
    }
});



module.exports = router;