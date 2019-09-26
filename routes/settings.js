const utils = require("../bin/utils");

var express = require('express');

var router = express.Router();

const dsteem = require('dsteem');
const client = new dsteem.Client('https://api.steemit.com');


const bodyParser = require('body-parser');
const urlencodedParser = bodyParser.urlencoded({limit: '500kb', extended: true});
const sanitize = require("xss");
const db = require("../bin/config").db;
const Joi = require('joi');

router.post('/get_trail',urlencodedParser, async function(req, res, next) {

    const username = sanitize(req.body.username);
    const token = sanitize(req.body.token);
    const type = sanitize(req.body.type);

    if (username && token && type) {

        const valid = await utils.valid_login(username, token, type);

        if (valid === true) {

            let data = await db("SELECT * FROM trail where username = ?", [username]);

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
    const trail_type = sanitize(req.body.trail_type);
    const type = sanitize(req.body.type);

    if (username && token) {

        let trailed_schema = Joi.object().keys({
            username: Joi.string().min(3).max(16).required(),
            ratio: Joi.number().min(0.1).max(2.5),
        });

        let test = Joi.validate({username : trailed, ratio : ratio}, trailed_schema);

        if (test.error !== null) {
            return res.send({status : "ko"});
        }

        const valid = await utils.valid_login(username, token, type);

        if (valid === true) {

            let data;

            if (trail_type === -1 || trail_type === 1)
                data = await db("SELECT 1 from trail where username = ? and trailed = ? and type IN (-1, 1)", [username, trailed]);
             else
                data = await db("SELECT 1 from trail where username = ? and trailed = ? and type = ?", [username, trailed, trail_type]);


            if (data.length !== 0) {
                return res.send({status: "ko", error: "already exists"});
            }

            await db("INSERT INTO trail(id, username, trailed, ratio, type) VALUE(NULL, ?, ?, ?, ?)", [username, trailed, ratio, trail_type]);

            return res.send({status : "ok"});
        } else
            return res.send({status : "ko"});
    }

    return res.send({status : "ko", data : "no_infos"});
});


router.post('/remove_trail',urlencodedParser, async function(req, res, next) {

    const username = sanitize(req.body.username);
    const token = sanitize(req.body.token);
    const type = sanitize(req.body.type);
    const trailed = sanitize(req.body.trailed);
    const trail_type = sanitize(req.body.trail_type);

    if (username && token && type) {

        let trailed_schema = Joi.object().keys({
            username: Joi.string().min(3).max(16).required(),
        });

        let test = Joi.validate({username : trailed}, trailed_schema);

        if (test.error !== null) {
            return res.send({status : "ko"});
        }

        const valid = await utils.valid_login(username, token, type);

        if (valid === true) {

            await db("DELETE FROM trail WHERE username = ? AND trailed = ? AND type = ?", [username, trailed, trail_type]);

            return res.send({status : "ok"});
        } else
            return res.send({status : "ko"});
    }

    return res.send({status : "ko", data : "no_infos"});
});



router.post('/update_threshold',urlencodedParser, async function(req, res, next) {

    const username = sanitize(req.body.username);
    const token = sanitize(req.body.token);
    const type = sanitize(req.body.type);
    const threshold = sanitize(req.body.threshold);

    if (username && token && type) {

        let schema = Joi.object().keys({
            threshold: Joi.number().min(0.1).max(100).required(),
        });

        let test = Joi.validate({threshold : threshold}, schema);

        if (test.error !== null) {
            return res.send({status : "ko"});
        }

        const valid = await utils.valid_login(username, token, type);

        if (valid === true) {

            await db("UPDATE user_data SET threshold = ? WHERE username = ?", [threshold, username]);

            return res.send({status : "ok"});
        } else
            return res.send({status : "ko"});
    }

    return res.send({status : "ko", data : "no_infos"});
});




router.post('/update_min_payout',urlencodedParser, async function(req, res, next) {

    const username = sanitize(req.body.username);
    const token = sanitize(req.body.token);
    const type = sanitize(req.body.type);
    const min_payout = sanitize(req.body.min_payout);

    if (username && token && type) {

        let schema = Joi.object().keys({
            min_payout: Joi.number().min(0).required(),
        });

        let test = Joi.validate({min_payout : min_payout}, schema);

        if (test.error !== null) {
            return res.send({status : "ko"});
        }

        const valid = await utils.valid_login(username, token, type);

        if (valid === true) {

            await db("UPDATE user_data SET min_payout = ? WHERE username = ?", [min_payout, username]);

            return res.send({status : "ok"});
        } else
            return res.send({status : "ko"});
    }

    return res.send({status : "ko", data : "no_infos"});
});




module.exports = router;