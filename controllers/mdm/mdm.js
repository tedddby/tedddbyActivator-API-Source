const mysql = require("mysql");
const env = require("dotenv");
const jwt = require("jsonwebtoken");
const request = require("request");
const xmlParser = require("xml2js");
const fs = require("fs");
const plist = require("simple-plist");
const path = require("path");
const { Webhook, MessageBuilder } = require('discord-webhook-node');
const zipdir = require("zip-dir");

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

db.connect((err) => {
    if(err) console.log(err);
});

const register = async (req, res) => {
    if(req.headers.authorization){
        try{
            const decoded = await promisify(jwt.verify)(req.headers.authorization, envData.JWT_Private_Key);
            const serial = decoded.SerialNumber;
            const service = decoded.Service;
            const email = decoded.Email;
            const amount = decoded.Amount;

            db.query("INSERT INTO serials SET ?", [{serial:serial, service:service, by_user:"api.v2", date:dateFormatted}], (err, resu) => {
                if(err) {
                    console.log(err);
                    return res.status(500).send("Internal Server Error!");
                }else{
                    var embed = new MessageBuilder()
                    .setTitle(`[MDM Bypass]: New Serial Registration`)
                    .addField('Serial', `${serial}`)
                    .addField('Service', `MDM Bypass`)
                    .addField('Customer Email', `${email}`)
                    .addField('Amount Paid', `${amount}`)
                    .setColor("#00FF00")
                    .setTimestamp();
                    new Webhook("https://discord.com/api/webhooks/770381246663491606/yGwDb71hoGuvNlanGTb7sJsPDSODw42OrkZ0gqDrVLi3rn3oh6zvr2W9V2WCk2qbEuZk").send(embed);

                    return res.status(200).send("Serial Registered Successfully!");
                }
            })
        }catch(e){
            console.log(e);
            return res.status(401).send("Invalid security token");
        }
    }else{
        return res.status(401).send("Security token not found");
    }
}



const activate = (req, res) => {
    console.log(req.body)
    try{
        db.query("SELECT * FROM serials WHERE serial = ?", [req.body.SerialNumber], (e,s) => {
            if(e){
                res.write("Internal SQL Error");
                res.end();
                return;
            }else{
                if(s && s != ""){
                    if(s[0].service == "MDM Bypass"){
                        var PlistFolder;
                        switch(req.body.type){
                            case "old":
                                PlistFolder = path.join(__dirname, 'o');
                            break;

                            case "new":
                                PlistFolder = path.join(__dirname, 'n');
                            break;

                            case "mega-new":
                                PlistFolder = path.join(__dirname, 'x');
                            break;   
                            
                            default:
                                PlistFolder = null;
                        }
                        //
                        const InfoPlist = plist.readFileSync(path.join(PlistFolder, 'Info.plist'));
                        InfoPlist["Device Name"] = req.body.DeviceName;
                        InfoPlist["Display Name"] = req.body.DisplayName;
                        InfoPlist["IMEI"] = req.body.IMEI;
                        InfoPlist["Product Name"] = req.body.ProductName;
                        InfoPlist["Product Type"] = req.body.ProductType;
                        InfoPlist["Product Version"] = req.body.ProductVersion;
                        InfoPlist["Serial Number"] = req.body.SerialNumber;
                        InfoPlist["Target Identifier"] = req.body.udid;
                        InfoPlist["Unique Identifier"] = req.body.udid;
                        plist.writeFileSync(path.join(PlistFolder, 'Info.plist'), InfoPlist);
                        //
                        const Manifest = plist.readFileSync(path.join(PlistFolder, 'Manifest.plist'));
                        Manifest.Lockdown.ProductVersion = req.body.ProductVersion;
                        Manifest.Lockdown.ProductType = req.body.ProductType;
                        Manifest.Lockdown.BuildVersion = req.body.BuildVersion;
                        Manifest.Lockdown.UniqueDeviceID = req.body.udid;
                        Manifest.Lockdown.SerialNumber = req.body.SerialNumber;
                        Manifest.Lockdown.DeviceName = req.body.DeviceName;
                        plist.writeBinaryFileSync(path.join(PlistFolder, 'Manifest.plist'), Manifest);
                        //
                        zipdir(PlistFolder, { saveTo: path.join(__dirname, path.join('devices', req.body.SerialNumber+".zip")) });
                        const DownloadLink = "https://api.v2.tedddby.com/mdm/download-backup/"+req.body.SerialNumber;

                        var embed = new MessageBuilder()
                        .setTitle(`[MDM Bypass]: Successfully Activated Device [Cached]`)
                        .addField('Serial', `${req.body.SerialNumber}`)
                        .addField('iDeviceType', `${req.body.type}`)
                        .addField('Backup URL', `${DownloadLink}`)
                        .setColor("#00FF00")
                        .setTimestamp();
                        new Webhook("https://discord.com/api/webhooks/771184406286958603/fTHp0LI470wA09irX0Z6SmV2ucMxNNUgsrdYv2NfH6QFQN8agWxd_IErhFsTeMXEifwB").send(embed);
                        
                        res.write(DownloadLink);
                        res.end();
                        return;
                    }else{
                        res.write("Your serial is registered for "+s[0].service+" but not for MDM Bypass");
                        res.end();
                        return;
                    }
                }else{
                    res.write("Serial Not Registered");
                    res.end();
                    return;  
                }
            }
        })
    }catch{
        res.write("Internal Server Error Caught");
        res.end();
        return;
    }    
}

/////////////////////////////////////////////////////////

const DownloadBackup = (req, res) => {
    const serial = req.originalUrl.replace("/mdm/download-backup/", "");
    if(serial.length == 12){
        var ZipFile = path.join(__dirname, path.join('devices', serial+".zip"));
        res.download(ZipFile, (e) => {
            if(e){
                res.write("No backup found for this device");
                res.end();
            }else{
                var embed = new MessageBuilder()
                .setTitle(`Successfully fetched backup ${serial} [MDM]`)
                .setColor("#FFFF00")
                .setTimestamp();
                new Webhook("https://discord.com/api/webhooks/771184406286958603/fTHp0LI470wA09irX0Z6SmV2ucMxNNUgsrdYv2NfH6QFQN8agWxd_IErhFsTeMXEifwB").send(embed);
            } 
        });
    }else{
        res.write("Invalid Serial Number \n");
        res.write("IP Address Banned "+req.ip);
        res.end();
        return;
    }
}

module.exports = {activate, register, DownloadBackup}