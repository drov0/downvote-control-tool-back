const utils = require("../bin/utils");

var express = require('express');
const sc2 = require('sc2-sdk');
const Joi = require('joi');
const fs = require('fs')

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
        callbackURL: req.app.get('env') === 'development' ? 'http://localhost:4002/auth/conf' : "",
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
                return res.send({status : "ok"});
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

            account.token = access_token

            account.json_metadata = JSON.parse(account.json_metadata);
            return res.send("<script> window.opener.postMessage('"+JSON.stringify(account)+"',\"*\"); window.close()</script>");
        }
    }

    return res.send("An error occured, please try again");
});



module.exports = router;