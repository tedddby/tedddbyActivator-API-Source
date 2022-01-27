const mysql = require("mysql");
const env = require("dotenv");
const jwt = require("jsonwebtoken");
const request = require("request");
const fs = require("fs");
const path = require("path");
const xmlParser = require("xml2js");
const {
    Webhook,
    MessageBuilder
} = require('discord-webhook-node');

const randtoken = require("rand-token");

const promisify = f => (...args) => new Promise((a, b) => f(...args, (err, res) => err ? b(err) : a(res)));

env.config({
    path: "./secret.env"
});

const envData = process.env;

const date = new Date();
const dateFormatted = date.toISOString().slice(0, 10);

const db = mysql.createConnection({
    host: envData.dbHost,
    database: envData.dbName,
    user: envData.dbUser,
    password: envData.dbPassword

});

db.connect((error) => {
    if (error) {
        console.log(error)
    } else {
        console.log("done")
    }
});

// #Records database:
const recDB = mysql.createConnection({
    host: envData.dbHost,
    database: "activation_records",
    user: envData.dbUser,
    password: envData.dbPassword

});

recDB.connect((error) => {
    if (error) {
        console.log(error)
    } else {
        console.log("done")
    }
});

const verify = async (req, res) => {
    if (req.headers.authorization) {
        try {
            const decoded = await promisify(jwt.verify)(req.headers.authorization, envData.JWT_Private_Key);
            if (decoded.serverIP && decoded.accessToken && decoded.user) {
                const decodedAccessToken = decoded.accessToken;
                const decodedServerIP = decoded.serverIP;
                const decodedUser = decoded.user;
                const ip = req.ip;
                if (ip == decodedServerIP) {
                    db.query("SELECT * FROM api_center WHERE server_ip = ?", [ip], (e, s) => {
                        if (e) {
                            return res.status(502).send("Internal Server Error!");
                        } else {
                            if(s && s != ""){
                                const token = s[0].access_token;
                            if (token == decodedAccessToken) {
                                if (parseInt(s[0].api_credits) != 0) {
                                    const APICredits = s[0].api_credits;
                                    if (req.body["activation-info"]) {
                                        ////////////////////////////////////////////
                                        const decoded = xmlParser.parseString(req.body["activation-info"], (er, rs) => {
                                            if (er) {
                                                return res.status(401).send("Invalid Activation Info");
                                            }
                                            if(rs){
                                                try{
                                                    const dictXMLinfo = xmlParser.parseString(Buffer.from(rs.dict.data[0], "base64").toString("utf-8"), (err, resu) => {
                                                        if (err) {
                                                            return res.status(401).send("Invalid Activation Info");
                                                        } else {
                                                            const serial = resu.plist.dict[0].dict[2].string[0];
        
                                                            //activate
                                                            const activationXML = req.body["activation-info"];
                                                            const apiKey = envData.BypassAPIKey;
                                                            recDB.query("SELECT * FROM records WHERE serial = ?", [serial], (e, s) => {
                                                                if (e) {
                                                                    return res.status(502).send("Internal Server Error!")
                                                                } else {
                                                                    if (s && s != "") {
                                                                        if (s[0].activation_record.startsWith("Albert")) {
                                                                            request.post({
                                                                                url: "https://s13.iremovalpro.com/API/drugted.php",
                                                                                headers: {
                                                                                    "Content-Type": "application/xml",
                                                                                    "Content-Lenght": activationXML.length + apiKey.length
                                                                                },
                                                                                form: {
                                                                                    "activation-info": activationXML,
                                                                                    "apiKey": apiKey
                                                                                }
                                                                            }, (reqError, reqResponse, reqBody) => {
                                                                                if (reqError) {
                                                                                    logger("REQUEST METHOD ERROR", reqError);
                                                                                    return res.status(500).send("Error Sending Request");
                                                                                } else {
                                                                                    if (reqResponse.statusCode === 200) {
                                                                                        recDB.query("INSERT INTO records SET ?", [{
                                                                                            serial: serial,
                                                                                            activation_record: reqBody,
                                                                                            service: "Auto-API-" + decodedUser
                                                                                        }], (e, s) => {
                                                                                            if (e) {
                                                                                                return res.status(502).send("Failed to store activation files!")
                                                                                            } else {
                                                                                                db.query("UPDATE api_center SET ? WHERE server_ip = ?", [{
                                                                                                    api_credits: parseInt(APICredits) - 1
                                                                                                }, ip], (er, rs) => {
                                                                                                    if (er) return res.status(502).send("Internal Server Error DB!");
                                                                                                    else {
                                                                                                        res.setHeader("Content-Length", reqBody.length);
                                                                                                        res.setHeader("Content-Type", "application/xml");
                                                                                                        res.writeHead(200);
                                                                                                        var embed = new MessageBuilder()
                                                                                                            .setTitle(`[API-CENTER]: Successfully Activated Device`)
                                                                                                            .addField('Serial', `${serial}`)
                                                                                                            .addField('User', `${decodedUser}`)
                                                                                                            .addField('Server IP', `${decodedServerIP}`)
                                                                                                            .setColor("#00FF00")
                                                                                                            .setTimestamp();
                                                                                                        new Webhook("https://discord.com/api/webhooks/878402272827150417/GQq8ZECmfF0JwvERaC-Ntf5dibJL8sH-oNFZsg6SXXXqBlPAMkSDyipXCit8pjLqLunG").send(embed);
                                                                                                        return res.write(reqBody);
                                                                                                    }
                                                                                                })
                                                                                            }
                                                                                        })
                                                                                    } else {
                                                                                        logger("iREMOVAL REQUEST FAILED", reqBody);
                                                                                        return res.status(reqResponse.statusCode).send("Operator rejected request");
                                                                                    }
                                                                                }
                                                                            })
                                                                        } else {
                                                                            res.setHeader("Content-Length", s[0].activation_record.length);
                                                                            res.setHeader("Content-Type", "application/xml");
                                                                            res.writeHead(200);
        
                                                                            var embed = new MessageBuilder()
                                                                                .setTitle(`[API-CENTER]: Successfully Activated Device [Cached]`)
                                                                                .addField('Serial', `${serial}`)
                                                                                .addField('User', `${decodedUser}`)
                                                                                .addField('Server IP', `${decodedServerIP}`)
                                                                                .setColor("#00FF00")
                                                                                .setTimestamp();
                                                                            new Webhook("https://discord.com/api/webhooks/878402272827150417/GQq8ZECmfF0JwvERaC-Ntf5dibJL8sH-oNFZsg6SXXXqBlPAMkSDyipXCit8pjLqLunG").send(embed);
        
                                                                            return res.write(s[0].activation_record);
                                                                        }
                                                                    } else {
                                                                        request.post({
                                                                            url: "https://s13.iremovalpro.com/API/drugted.php",
                                                                            headers: {
                                                                                "Content-Type": "application/xml",
                                                                                "Content-Lenght": activationXML.length + apiKey.length
                                                                            },
                                                                            form: {
                                                                                "activation-info": activationXML,
                                                                                "apiKey": apiKey
                                                                            }
                                                                        }, (reqError, reqResponse, reqBody) => {
                                                                            if (reqError) {
                                                                                logger("REQUEST METHOD ERROR", reqError);
                                                                                return res.status(500).send("Error Sending Request");
                                                                            } else {
                                                                                if (reqResponse.statusCode === 200) {
                                                                                    recDB.query("INSERT INTO records SET ?", [{
                                                                                        serial: serial,
                                                                                        activation_record: reqBody,
                                                                                        service: "Auto-API-" + decodedUser
                                                                                    }], (e, s) => {
                                                                                        if (e) {
                                                                                            return res.status(502).send("Failed to store activation files!")
                                                                                        } else {
                                                                                            db.query("UPDATE api_center SET ? WHERE server_ip = ?", [{
                                                                                                api_credits: parseInt(APICredits) - 1
                                                                                            }, ip], (er, rs) => {
                                                                                                if (er) return res.status(502).send("Internal Server Error DB!");
                                                                                                else {
                                                                                                    res.setHeader("Content-Length", reqBody.length);
                                                                                                    res.setHeader("Content-Type", "application/xml");
                                                                                                    res.writeHead(200);
                                                                                                    var embed = new MessageBuilder()
                                                                                                        .setTitle(`[API-CENTER]: Successfully Activated Device`)
                                                                                                        .addField('Serial', `${serial}`)
                                                                                                        .addField('User', `${decodedUser}`)
                                                                                                        .addField('Server IP', `${decodedServerIP}`)
                                                                                                        .setColor("#00FF00")
                                                                                                        .setTimestamp();
                                                                                                    new Webhook("https://discord.com/api/webhooks/878402272827150417/GQq8ZECmfF0JwvERaC-Ntf5dibJL8sH-oNFZsg6SXXXqBlPAMkSDyipXCit8pjLqLunG").send(embed);
                                                                                                    return res.write(reqBody);
                                                                                                }
                                                                                            })
                                                                                        }
                                                                                    })
                                                                                } else {
                                                                                    logger("iREMOVAL REQUEST FAILED", reqBody);
                                                                                    return res.status(reqResponse.statusCode).send("Operator rejected request");
                                                                                }
                                                                            }
                                                                        })
                                                                    }
                                                                }
                                                            })
                                                            //end-activate
                                                        }
                                                    })
                                                }catch(e){
                                                    return res.status(403).send("Deforemed activation info!")
                                                }
                                            }else{
                                                return res.status(401).send("Deformed activation info!")
                                            }
                                        })
                                        ////////////////////////////////////////////
                                    } else {
                                        var embed = new MessageBuilder()
                                            .setTitle(`[API-CENTER]: Empty activation info`)
                                            .addField('User', `${decodedUser}`)
                                            .addField('Server IP', `${decodedServerIP}`)
                                            .setColor("#FF0000")
                                            .setTimestamp();
                                        new Webhook("https://discord.com/api/webhooks/878402272827150417/GQq8ZECmfF0JwvERaC-Ntf5dibJL8sH-oNFZsg6SXXXqBlPAMkSDyipXCit8pjLqLunG").send(embed);
                                        return res.status(403).send("No activation info provided!");
                                    }
                                } else {
                                    return res.status(401).send("Insufficient API credits!, contact @tedddby on Telegram to recharge.");
                                }
                            } else {
                                var embed = new MessageBuilder()
                                    .setTitle(`[API-CENTER]: Invalid API Token`)
                                    .addField('User', `${decodedUser}`)
                                    .addField('Server IP', `${decodedServerIP}`)
                                    .setColor("#FF0000")
                                    .setTimestamp();
                                new Webhook("https://discord.com/api/webhooks/878402272827150417/GQq8ZECmfF0JwvERaC-Ntf5dibJL8sH-oNFZsg6SXXXqBlPAMkSDyipXCit8pjLqLunG").send(embed);
                                return res.status(401).send("Invalid API token");
                            }
                            }else{
                                var embed = new MessageBuilder()
                                    .setTitle(`[API-CENTER]: Unregistered user request!`)
                                    .addField('User', `${decodedUser}`)
                                    .addField('Server IP', `${decodedServerIP}`)
                                    .setColor("#FF0000")
                                    .setTimestamp();
                                new Webhook("https://discord.com/api/webhooks/878402272827150417/GQq8ZECmfF0JwvERaC-Ntf5dibJL8sH-oNFZsg6SXXXqBlPAMkSDyipXCit8pjLqLunG").send(embed);
                                return res.status(401).send("Invalid user!");
                            }
                        }
                    })
                } else {
                    var embed = new MessageBuilder()
                        .setTitle(`[API-CENTER]: Server IP doesn't match`)
                        .addField('User', `${decodedUser}`)
                        .addField('Expected IP', `${decodedServerIP}`)
                        .addField('Received IP', `${ip}`)
                        .setColor("#FF0000")
                        .setTimestamp();
                    new Webhook("https://discord.com/api/webhooks/878402272827150417/GQq8ZECmfF0JwvERaC-Ntf5dibJL8sH-oNFZsg6SXXXqBlPAMkSDyipXCit8pjLqLunG").send(embed);
                    return res.status(401).send("Server IP doesnt match the IP on file!");
                }
            }
        } catch {
            return res.status(401).send("Malformed API token");
        }
    } else {
        return res.status(401).send("No key provided!");
    }
}

const genKey = (req, res) => {
    const genKeyPassword = "TedddbyactivatoR2!";
    const genKeyInsertedPassword = req.query.password;

    if(genKeyPassword == genKeyInsertedPassword){
        var accessToken = randtoken.generate(30);
        var token = jwt.sign({serverIP: req.query.server, accessToken:accessToken, user:req.query.user}, envData.JWT_Private_Key, { });
        return res.status(200).send(token);
    }else{
        return res.status(401).send("Invalid Password!");
    }
}




module.exports = {verify, genKey}