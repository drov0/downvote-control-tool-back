const utils = require("../bin/utils");

var express = require('express');

var router = express.Router();

const dsteem = require('dsteem');
const client = new dsteem.Client('https://api.steemit.com');


const bodyParser = require('body-parser');
const urlencodedParser = bodyParser.urlencoded({limit: '500kb', extended: true});
const sanitize = require("xss");
const db = require("../bin/config").db;

router.post('/get_negative_trail',urlencodedParser, async function(req, res, next) {

    const username = sanitize(req.body.username);
    const token = sanitize(req.body.token);

    if (username && token) {

        const valid = await utils.sc_valid(username, token);

        if (valid[0] === true) {

            let data = await db("SELECT * FROM trail where username = ? AND negative = -1", [username]);

            return res.send({status : "ok", data});
        } else
            return res.send({status : "ko"});
    }

    return res.send({status : "ko", data : "no_infos"});
});


router.post('/get_positive_trail',urlencodedParser, async function(req, res, next) {

    const username = sanitize(req.body.username);
    const token = sanitize(req.body.token);

    if (username && token) {

        const valid = await utils.sc_valid(username, token);

        if (valid[0] === true) {

            let data = await db("SELECT * FROM trail where username = ? AND negative = 1", [username]);

            return res.send({status : "ok", data});
        } else
            return res.send({status : "ko"});
    }

    return res.send({status : "ko", data : "no_infos"});
});




module.exports = router;