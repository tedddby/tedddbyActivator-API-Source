const axios = require("axios");
const grayLicense = "87E5D3DC79514D02";
const fs = require("fs");
const request = require("request");
const { text } = require("body-parser");
const jwt = require("jsonwebtoken");
const mysql = require("mysql");
const env = require("dotenv");
const { Webhook, MessageBuilder } = require('discord-webhook-node');
const path = require("path");

env.config({
    path:"./secret.env"
})

var date = new Date();
var dateFormatted = date.toISOString().slice(0,10);

const promisify = f => (...args) => new Promise((a,b)=>f(...args, (err, res) => err ? b(err) : a(res)));

const db = mysql.createConnection({
    host: process.env.dbHost,
    user: process.env.dbUser,
    password: process.env.dbPassword,
    database: process.env.dbName
})
var eerrPub;
db.connect((error) => {
    if(error){
		eerrPub = error;
        console.log("database error ("+error+")");
    }else{
        console.log("database connected");
    }
})

const chain = (req, res) => {
   
    var {serial, udid} = req.headers;

    var devicePath = path.join(__dirname, 'devices_carrier/'+serial+'_chain.txt');
    
   db.query("SELECT * FROM serials WHERE serial = ?", [serial], (error, result) => {
       if(error){
           console.log(error);
           return res.status(500).send("Internal Server Error!");
       }else{
           if(result && result != ""){
               if(result[0].service == "Carrier Bypass"){
                   var skip;
                   db.query("SELECT * FROM carrier WHERE serial = ?", [serial], (er, rs) => {
                       if(er){
                           return res.send("Internal Server Error!");
                       }else{
                           if(rs && rs != ""){
                               skip = true;
                               //fetch chain
                               request.get({url:`https://api.bluestore.link/carrier.php?fetch=0&udid=${udid}&sn=${serial}&model=iPhone6`}, (e, s, b) => {
                                   if(e){
                                       return res.send("Internal Server Error");
                                   }else{
                                    fs.writeFile(devicePath, b, (error) => {if(error) {console.log(error);}});
                                    
                                    var embed = new MessageBuilder()
                                    .setTitle(`[Carrier Bypass]: Chain Fetched`)
                                    .addField('Serial', `${serial}`)
                                    .addField('UDID', `${udid}`)
                                    .addField("First Time", "No")
                                    .setColor("#00FF00")
                                    .setTimestamp();
                                    new Webhook("https://discord.com/api/webhooks/771184406286958603/fTHp0LI470wA09irX0Z6SmV2ucMxNNUgsrdYv2NfH6QFQN8agWxd_IErhFsTeMXEifwB").send(embed);
                                    
                                    return res.send(b);
                                   }
                               });
                               //
                           }else{
                               db.query("INSERT INTO carrier SET ?", [{serial:serial, udid:udid, model:"iPhone 6"}], (err, resu) => {
                                   if(err){
                                       return res.send("Internal Server Error");
                                   }else{
                                       request.get({url:`https://api.bluestore.link/carrier.php?license=${grayLicense}&sn=${serial}&udid=${udid}`}, (errorReq, resReq, bodyReq) => {
                                           if(errorReq){
                                               return res.send("Internal Server Error -req");
                                           }else{
                                               if(bodyReq == "Registered Successfully!"){
                                                   skip = true;
                                                   //fetch chain
                                                   request.get({url:`https://api.bluestore.link/carrier.php?fetch=0&udid=${udid}&sn=${serial}&model=iPhone6`}, (e, s, b) => {
                                                       if(e){
                                                           return res.send("Internal Server Error!");
                                                       }else{
                                                        fs.writeFile(devicePath, b, (error) => {if(error) {console.log(error);}});

                                                        var embed = new MessageBuilder()
                                                        .setTitle(`[Carrier Bypass]: Chain Fetched`)
                                                        .addField('Serial', `${serial}`)
                                                        .addField('UDID', `${udid}`)
                                                        .addField("First Time", "Yes")
                                                        .setColor("#00FF00")
                                                        .setTimestamp();
                                                        new Webhook("https://discord.com/api/webhooks/771184406286958603/fTHp0LI470wA09irX0Z6SmV2ucMxNNUgsrdYv2NfH6QFQN8agWxd_IErhFsTeMXEifwB").send(embed);
                                                        
                                                        return res.send(b);
                                                       }
                                                   })
                                                   //
                                               }else{

                                                var embed = new MessageBuilder()
                                                .setTitle(`[Carrier Bypass]: GrayRhin License Expired`)
                                                .addField('Source', `Chain API`)
                                                .setColor("#FF0000")
                                                .setTimestamp();
                                                new Webhook("https://discord.com/api/webhooks/771184406286958603/fTHp0LI470wA09irX0Z6SmV2ucMxNNUgsrdYv2NfH6QFQN8agWxd_IErhFsTeMXEifwB").send(embed);

                                                return res.send("Message an admin!");
                                               }
                                           }
                                       })
                                   }
                               })
                           }
                       }
                   });
               }else{

                var embed = new MessageBuilder()
                .setTitle(`[Carrier Bypass]: Serial Registered But Not For Carrier`)
                .addField('Serial', `${serial}`)
                .addField('UDID', `${udid}`)
                .setColor("#FF0000")
                .setTimestamp();
                new Webhook("https://discord.com/api/webhooks/771184406286958603/fTHp0LI470wA09irX0Z6SmV2ucMxNNUgsrdYv2NfH6QFQN8agWxd_IErhFsTeMXEifwB").send(embed);

                   return res.status(403).send("Your serial is registered but not for carrier bypass, registered service: "+result[0].service);
               }
           }else{

            var embed = new MessageBuilder()
            .setTitle(`[Carrier Bypass]: Unregistered Chain Request`)
            .addField('Serial', `${serial}`)
            .addField('UDID', `${udid}`)
            .setColor("#FF0000")
            .setTimestamp();
            new Webhook("https://discord.com/api/webhooks/771184406286958603/fTHp0LI470wA09irX0Z6SmV2ucMxNNUgsrdYv2NfH6QFQN8agWxd_IErhFsTeMXEifwB").send(embed);

               return res.status(401).send("sorry - your serial isnt registered");
           }
       }
   })
}


const register = async (req, res) => {
    if(req.headers.authorization){
        try{
            const decoded = await promisify(jwt.verify)(req.headers.authorization, process.env.JWT_Private_Key);
            const serial = decoded.SerialNumber;
            const udid = "Registered By Tedddby";
            const email = decoded.Email;
            const amount = decoded.Amount;
        
                if(serial != "" || serial.length != 12){
                    if(udid != ""){
                        db.query("INSERT INTO serials SET ?", [{serial:serial, by_user:"api.v2", date:dateFormatted, service:"Carrier Bypass"}], (er, rs) => {
                            if(er){
                                return res.send("Internal Server Error!");
                            }else{
                                var embed = new MessageBuilder()
                                    .setTitle(`[Carrier Bypass]: New Serial Registration`)
                                    .addField('Serial', `${serial}`)
                                    .addField('Service', `Carrier Bypass`)
                                    .addField('Customer Email', `${email}`)
                                    .addField('Amount Paid', `${amount}`)
                                    .setColor("#00FF00")
                                    .setTimestamp();
                                    new Webhook("https://discord.com/api/webhooks/770381246663491606/yGwDb71hoGuvNlanGTb7sJsPDSODw42OrkZ0gqDrVLi3rn3oh6zvr2W9V2WCk2qbEuZk").send(embed);
                                return res.status(200).send("Serial Registered Successfully!");
                            }
                        })
                    }else{
                        return res.status(200).send("You're not allowed here! [-5]");
                    }
                }else{
                    return res.status(200).send("You're not allowed here! [-4]");
                }
}catch(e){
    return res.status(200).send("Invalid Security Token");
}
}else{
    return res.status(200).send("Missing security token");
}
}


module.exports={chain, register};


