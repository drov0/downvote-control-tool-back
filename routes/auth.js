const utils = require("../bin/utils");

var express = require('express');
const sc2 = require('sc2-sdk');
const db = require("../bin/config").db;
var router = express.Router();

const dsteem = require('dsteem');
const client = new dsteem.Client('https://api.steemit.com');

const bodyParser = require('body-parser');
const urlencodedParser = bodyParser.urlencoded({limit: '500kb', extended: true});
const sanitize = require("xss");


router.get('/',  function(req, res, next) {

    // init steemconnect
    let api = sc2.Initialize({
        app:'downvote-tool',
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

            return res.send({status : "ok", threshold : data.threshold});
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


            const account = (await client.database.getAccounts([username]))[0];

            let data = await db("SELECT * FROM user_data WHERE username = ?", [username]);

            if (data.length === 0) {
                await db("INSERT INTO user_data(username, threshold) VALUES(?,80)", [username]);
                account.threshold = 80;
            } else {
                account.threshold =  data[0].threshold;
            }
                account.token = access_token;

            account.json_metadata = JSON.parse(account.json_metadata);
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
                app: 'downvote-tool',
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