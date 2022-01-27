const mysql = require("mysql");
const env = require("dotenv");
const jwt = require("jsonwebtoken");
const request = require("request");
const fs = require("fs");
const path = require("path");
const xmlParser = require("xml2js");
const { Webhook, MessageBuilder } = require('discord-webhook-node');

const LogPath = path.join(__dirname, `/logs/log.txt`);

const promisify = f => (...args) => new Promise((a,b)=>f(...args, (err, res) => err ? b(err) : a(res)));

env.config({
    path:"./secret.env"
});

const envData = process.env;

const date = new Date();
const dateFormatted = date.toISOString().slice(0,10);

const db = mysql.createConnection({
    host:envData.dbHost,
    database:envData.dbName,
    user:envData.dbUser,
    password:envData.dbPassword

});

db.connect((error) => {
    if(error){
    logger("DATABASE CONNECTION ERROR", error);
    }else{
    logger("DATABASE CONNECTED", error);
    }
}
);

// #Records database:
const recDB = mysql.createConnection({
    host:envData.dbHost,
    database:"activation_records",
    user:envData.dbUser,
    password:envData.dbPassword

});

recDB.connect((error) => {
    if(error){
    logger("DATABASE CONNECTION ERROR", error);
    }else{
    logger("DATABASE CONNECTED", error);
    }
}
);

const logger = (title, data) => {
    fs.readFile(LogPath, (error, result) => {
        if(error){
            return false;
        }else{
            const currentContent = result;
            const newContent = `${currentContent} \n\n -NEW LOG FILE || TITLE: (${title}) || DATE: (${dateFormatted}) \nBODY:: ( ${data} )`;
            fs.writeFile(LogPath, newContent, (ex) => {
                if(ex) return false;
            })
        }
    })
}

const register = async (req, res) => {
    if(req.headers.authorization){
        try{
            const decoded = await promisify(jwt.verify)(req.headers.authorization, envData.JWT_Private_Key);
            const service = decoded.Service;
            const serial = decoded.SerialNumber;
            const email = decoded.Email;
            const amount = decoded.Amount;

            if(service == "" || serial == "" || serial.length != 12 || service != "MEID Bypass"){
                return res.status(401).send("Invalid Serial Number or Service");
            }else{
                db.query("INSERT INTO serials SET ?", [{serial:serial, service:service, by_user:"api.v2", date:dateFormatted}], (error, result) => {
                    if(error){
                        return res.status(500).send("Internal Server Error -1");
                    }else{

                        var embed = new MessageBuilder()
                        .setTitle(`[MEID Bypass]: New Serial Registration`)
                        .addField('Serial', `${serial}`)
                        .addField('Service', `MEID Bypass`)
                        .addField('Customer Email', `${email}`)
                        .addField('Amount Paid', `${amount}`)
                        .setColor("#00FF00")
                        .setTimestamp();
                        new Webhook("https://discord.com/api/webhooks/770381246663491606/yGwDb71hoGuvNlanGTb7sJsPDSODw42OrkZ0gqDrVLi3rn3oh6zvr2W9V2WCk2qbEuZk").send(embed);

                        return res.status(200).send("Serial Registered Successfully!");
                    }
                })
            }

        }catch(e){
            return res.status(401).send("Invalid Authorization Token");
        }
    }
}

const checkActivationRecord = (serial) => {
    recDB.query("SELECT * FROM records WHERE serial = ?", [serial], (e,s)=> {
        if(e){
            zScoop = false;
        }else{
            if(s && s != ""){
                if(s[0].activation_record.startsWith("Albert")){
                    zScoop = false;
                }else{
                    zScoop = s[0].activation_record;
                }
            }else{
                zScoop = false;
            }
        }
    })
    return zScoop;
}

const activate = (req, res) => {
    if(req.body["activation-info"]){
        const activationXML = req.body["activation-info"];
        const apiKey = envData.BypassAPIKey;
        var activated = false;
        try{
        const decoded = xmlParser.parseString(activationXML, (er, rs) => {
            if(er){
                return res.status(401).send("Invalid Activation Info");
            }
            const dictXMLinfo = xmlParser.parseString(Buffer.from(rs.dict.data[0], "base64").toString("utf-8"), (err, resu) => {
                if(err){
                    return res.status(401).send("Invalid Activation Info");
                }else{
                    var serial;
                    if(resu.plist.dict[0].dict[2].string[0].length == 12){
                        serial = resu.plist.dict[0].dict[2].string[0];
                    }else{
                        serial = resu.plist.dict[0].dict[1].string[0]
                    }
                    const devicePath = path.join(__dirname, `devices/${serial}`);

                    db.query("SELECT * FROM serials WHERE serial = ?", [serial], (error, result) => {
                        if(error){
                            logger("DATABASE QUERY ERROR", error);
                            return res.status(501).send("Intenral Server Error");
                        }else{
                            if(result && result != ""){
                                if(result[0].service != "MEID Bypass"){
                                    return res.send("Your iDevice is registered but not for MEID Bypass! Contact @tedddby On Telegram. Have A Nice Day!")
                                }

                                recDB.query("SELECT * FROM records WHERE serial = ?", [serial], (e,s)=> {
                                    if(e){
                                        return res.status(502).send("Internal Server Error!")
                                    }else{
                                        if(s && s != ""){
                                            if(s[0].activation_record.startsWith("Albert")){
                                                request.post({
                                                    url: "https://s13.iremovalpro.com/API/drugted.php",
                                                    headers: {
                                                        "Content-Type": "application/xml",
                                                        "Content-Lenght": activationXML.length + apiKey.length,
														"User-Agent":"iOS Device Activator (MobileActivation-20 built on Jan 15 2012 at 19:07:28)"
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
                                                                service: "MEID Bypass"
                                                            }], (e, s) => {
                                                                if (e) {
                                                                    return res.status(502).send("Failed to store activation files!")
                                                                } else {
                                                                    res.setHeader("Content-Length", reqBody.length);
                                                                    res.setHeader("Content-Type", "application/xml");
                                                                    res.writeHead(200);
                                                                    var embed = new MessageBuilder().setTitle(`[MEID Bypass]: Successfully Activated Device`).addField('Serial', `${serial}`).setColor("#00FF00").setTimestamp();
                                                                    new Webhook("https://discord.com/api/webhooks/771184406286958603/fTHp0LI470wA09irX0Z6SmV2ucMxNNUgsrdYv2NfH6QFQN8agWxd_IErhFsTeMXEifwB").send(embed);
                                                                    return res.write(reqBody);
                                                                }
                                                            })
                                                        } else {
                                                            logger("iREMOVAL REQUEST FAILED", reqBody);
                                                            return res.status(reqResponse.statusCode).send("Operator rejected request");
                                                        }
                                                    }
                                                })
                                            }else{
                                                res.setHeader("Content-Length", s[0].activation_record.length);
                                                res.setHeader("Content-Type", "application/xml");
                                                res.writeHead(200);
    
                                                var embed = new MessageBuilder()
                                                .setTitle(`[MEID Bypass]: Successfully Activated Device [Cached]`)
                                                .addField('Serial', `${serial}`)
                                                .setColor("#00FF00")
                                                .setTimestamp();
                                                new Webhook("https://discord.com/api/webhooks/771184406286958603/fTHp0LI470wA09irX0Z6SmV2ucMxNNUgsrdYv2NfH6QFQN8agWxd_IErhFsTeMXEifwB").send(embed);
    
                                                return res.write(s[0].activation_record);
                                            }
                                        }else{
                                            request.post({
                                                url: "https://s13.iremovalpro.com/API/drugted.php",
                                                headers: {
                                                    "Content-Type": "application/xml",
                                                    "Content-Lenght": activationXML.length + apiKey.length,
													"User-Agent":"iOS Device Activator (MobileActivation-20 built on Jan 15 2012 at 19:07:28)"
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
                                                            service: "MEID Bypass"
                                                        }], (e, s) => {
                                                            if (e) {
                                                                return res.status(502).send("Failed to store activation files!")
                                                            } else {
                                                                res.setHeader("Content-Length", reqBody.length);
                                                                res.setHeader("Content-Type", "application/xml");
                                                                res.writeHead(200);
                                                                var embed = new MessageBuilder().setTitle(`[MEID Bypass]: Successfully Activated Device`).addField('Serial', `${serial}`).setColor("#00FF00").setTimestamp();
                                                                new Webhook("https://discord.com/api/webhooks/771184406286958603/fTHp0LI470wA09irX0Z6SmV2ucMxNNUgsrdYv2NfH6QFQN8agWxd_IErhFsTeMXEifwB").send(embed);
                                                                return res.write(reqBody);
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
                            }else{
                                var embed = new MessageBuilder()
                                .setTitle(`[MEID Bypass]: Unregistered Request`)
                                .addField('Serial', `${serial}`)
                                .addField('Service', `MEID Bypass`)
                                .setColor("#FF0000")
                                .setTimestamp();
                                new Webhook("https://discord.com/api/webhooks/771184406286958603/fTHp0LI470wA09irX0Z6SmV2ucMxNNUgsrdYv2NfH6QFQN8agWxd_IErhFsTeMXEifwB").send(embed);

                                return res.status(401).send("Unregistered Serial Number");
                            }
                        }
                    })
                }
            })
        })      
        }catch(e){
            logger("meid Catch", e);
            return res.send("Invalid Activation XML!");
        }
    }else{
        return res.status(401).send("...");
    }
}

const getRecord = (req, res) => {
    const serial = req.originalUrl.replace("/meid/records/", "");

    if(serial.length != 12 || serial.includes("/") || serial.includes("-") || serial == ""){
        return res.status(401).send("INVALID SERIAL NUMBER!");
    }else{

        db.query("SELECT * FROM serials WHERE serial = ?", [serial], (error, result) => {
            if(error){
                logger("DATABASE QUERY ERROR", error);
                return res.status(500).send("Internal Server Error!");
            }else{ 
                if(result && result != ""){
                    if(result[0].service == "MEID Bypass") {
                        try{
                            recDB.query("SELECT * FROM records WHERE serial = ?", [serial], (e,s) => {
                                if(e) return res.status(502).send("Internal Server Error!");
                                else{
                                    if(s && s != ""){
                                        var embed = new MessageBuilder()
                                        .setTitle(`Successfully fetched record for ${serial} [MEID]`)
                                        .setColor("#FFFF00")
                                        .setTimestamp();
                                        new Webhook("https://discord.com/api/webhooks/771184406286958603/fTHp0LI470wA09irX0Z6SmV2ucMxNNUgsrdYv2NfH6QFQN8agWxd_IErhFsTeMXEifwB").send(embed);

                                    const recordFormatted = formatt(s[0].activation_record);
                                    return res.send(recordFormatted);
                                    }else{
                                        return res.send("No activation record found for this iDevice");
                                    }
                                }
                            })
						}catch(e){
							return res.send("No activation record found for this iDevice");
						}
                    }else{
                        return res.send("Serial Is Not Registered For MEID Bypass, Its Registered For "+result[0].service)
                    }
                }else{
                    return res.send("Unregistered Serial Number");
                }
            }
        })
    }
}

const formatt = (data) => {
    var ActivationRecord;
     const getRecord = xmlParser.parseString(data, (err, rsu) => {
        if(err) {
            console.log(error);
            ActivationRecord = "Internal Server Error";
        }
        else{
            if(data.includes("<key>FairPlayKeyData</key>") != true){
                ActivationRecord = "No Activation Record";
            }
            
            const AccountTokenCertificate = rsu.plist.dict[0].dict[0].dict[0].data[1]; //1
            const DeviceCertificate = rsu.plist.dict[0].dict[0].dict[0].data[2]; //2
            const FairPlayKeyData = rsu.plist.dict[0].dict[0].dict[0].data[0]; //0
            const AccountToken = rsu.plist.dict[0].dict[0].dict[0].data[3]; //3
            const AccountTokenSignature = rsu.plist.dict[0].dict[0].dict[0].data[4]; //4

            const AccTokenDecoded = Buffer.from(AccountToken, "base64").toString("utf-8");
            const WildCard = AccTokenDecoded.split('"WildcardTicket" = "')[1].split('";')[0];
            

            ActivationRecord = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>AccountToken</key>
    <data>${AccountToken}</data>
    <key>AccountTokenCertificate</key>
    <data>${AccountTokenCertificate}</data>
    <key>AccountTokenSignature</key>
    <data>${AccountTokenSignature}</data>
    <key>DeviceCertificate</key>
    <data>${DeviceCertificate}</data>
    <key>DeviceConfigurationFlags</key>
    <string>0</string>
    <key>FairPlayKeyData</key>
    <data>${FairPlayKeyData}</data>
    <key>LDActivationVersion</key>
    <integer>2</integer>
    <key>unbrick</key>
    <true/>
    <key>WildcardTicketToRemove</key>
    <data>${WildCard}</data>
</dict>
</plist>`;
        }
    })
    return ActivationRecord;
}






module.exports = {register, activate, getRecord}