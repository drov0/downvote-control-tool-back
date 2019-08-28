const utils = require("../bin/utils");

var express = require('express');

var router = express.Router();

const dsteem = require('dsteem');
const client = new dsteem.Client('https://api.steemit.com');


const bodyParser = require('body-parser');
const urlencodedParser = bodyParser.urlencoded({limit: '500kb', extended: true});
const sanitize = require("xss");
const db = require("../bin/config").db;

router.post('/get_trail',urlencodedParser, async function(req, res, next) {

    const username = sanitize(req.body.username);
    const token = sanitize(req.body.token);
    const positive = sanitize(req.body.positive);

    if (username && token) {

        const valid = await utils.sc_valid(username, token);

        if (valid[0] === true) {

            let data = await db("SELECT * FROM trail where username = ? AND negative = ?", [username, positive]);

            return res.send({status : "ok", data});
        } else
            return res.send({status : "ko"});
    }

    return res.send({status : "ko", data : "no_infos"});
});


router.post('/add_trail',urlencodedParser, async function(req, res, next) {

    const username = sanitize(req.body.username);
    const token = sanitize(req.body.token);
    const trailed = sanitize(req.body.trailed);
    const ratio = sanitize(req.body.ratio);
    const positive = sanitize(req.body.positive);




    if (username && token) {

        let trailed_schema = Joi.object().keys({
            username: Joi.string().min(3).max(16).required(),
            ratio: Joi.number().integer().min(0.1).max(2.5),
        });

        let test = Joi.validate({username : trailed, ratio : ratio}, trailed_schema);

        if (test.error !== null) {
            return res.send({status : "ko"});
        }

        const valid = await utils.sc_valid(username, token);

        if (valid[0] === true) {

            await db("INSERT INTO trail(id, username, trailed, ratio, negative) VALUE(NULL, ?, ?, ?, ?)", [username, trailed, ratio, positive]);

            return res.send({status : "ok"});
        } else
            return res.send({status : "ko"});
    }

    return res.send({status : "ko", data : "no_infos"});
});




module.exports = router;