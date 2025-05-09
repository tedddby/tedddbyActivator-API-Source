const mysql = require("mysql");
const env = require("dotenv");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const { Webhook, MessageBuilder } = require('discord-webhook-node');

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
        console.log(error);
    }
}
);

const register = async (req, res) => {
    if(req.headers.authorization){
        try{
            const decoded = await promisify(jwt.verify)(req.headers.authorization, envData.JWT_Private_Key);
            const service = decoded.Service;
            const serial = decoded.SerialNumber;
            const email = decoded.Email;
            const amount = decoded.Amount;
            const soldbyCheck = decoded.SoldBy;

            if(service == "" || serial == "" || serial.length != 12 || service != "FMI OFF"){
                return res.status(401).send("Invalid Serial Number or Service");
            }else{
                db.query("INSERT INTO serials SET ?", [{serial:serial, service:service, by_user:"api.v2", date:dateFormatted}], (error, result) => {
                    if(error){
                        return res.status(500).send("Internal Server Error -1");
                    }else{

                        HandleSoldby(soldbyCheck);

                        var embed = new MessageBuilder()
                        .setTitle(`[FMI OFF]: New Serial Registration`)
                        .addField('Serial', `${serial}`)
                        .addField('Service', `FMI OFF`)
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

const HandleSoldby = async (soldby) => { 

    var soldbyInitialValue = JSON.parse(toJson(soldby.toLowerCase()));
    var soldbyFinalValue = {};

    for(i=0; i < Object.keys(soldbyInitialValue).length; i++){
        var oldKey = Object.keys(soldbyInitialValue)[i]; 
        var newKey = Object.keys(soldbyInitialValue)[i].replace(/\s/g,"");
        soldbyFinalValue[''+newKey+''] = soldbyInitialValue[oldKey];
    }

    var icloudStatus;

    if(!soldbyFinalValue.icloudstatus){
        if(soldbyFinalValue.fmilost){
            if(soldbyFinalValue.fmilost.replace(/\s/g,"").toUpperCase() == "Y"){
                icloudStatus = "LOST";
            }else{
                icloudStatus = "CLEAN";
            }
        }else{
            icloudStatus = "UNKNOWN";
        }
    }else{
        icloudStatus = soldbyFinalValue.icloudstatus.replace(/\s/g,"").toUpperCase();
    }

    var purchaseDate;

    if(!soldbyFinalValue.purchasedate){
        purchaseDate = "1/1/1956";
    }else{
        purchaseDate = soldbyFinalValue.purchasedate.replace(/\s/g,"");
    }

    var purchaseCountry;

    if(!soldbyFinalValue.purchasecountry){
        purchaseCountry = "1/1/1956";
    }else{
        purchaseCountry = soldbyFinalValue.purchasecountry.replace(/\s/g,"").toUpperCase();
    }

    var soldToName = soldbyFinalValue.soldtoname.toUpperCase();
    var imei = soldbyFinalValue.imei.replace(/\s/g,"");

    try{
        db.query("INSERT INTO fmi SET ?", [{id:imei, imei:imei, sold_to:soldToName, purchase_country:purchaseCountry, purchase_date:purchaseDate, icloud_status:icloudStatus}], (error, result) => {
            if(error){
                console.log("db error------------"+error);
            }else{

                var embed = new MessageBuilder()
                .setTitle(`[FMI OFF]: Data stored`)
                .addField('IMEI', `${imei}`)
                .addField('SOLD TO', `${soldToName}`)
                .addField('PURCHASE COUNTRY', `${purchaseCountry}`)
                .addField('PURCHASE DATE', `${purchaseDate}`)
                .addField('iCLOUD STATUS', `${icloudStatus}`)
                .addField('Check Link', 'https://tedddby.com/fmi/soldbycheck/fetch/'+imei)
                .setColor("#00FF00")
                .setTimestamp();
                new Webhook("https://discord.com/api/webhooks/770381246663491606/yGwDb71hoGuvNlanGTb7sJsPDSODw42OrkZ0gqDrVLi3rn3oh6zvr2W9V2WCk2qbEuZk").send(embed);

                //storing to server
                var filePath = path.join(__dirname, `/devices/${imei}.txt`);
                var content = soldby +'\n\n //////////////////////////////////////////////'+JSON.stringify(soldbyFinalValue);
                fs.writeFile(filePath, content, (ex) => {
                    if(ex) return false;
                })

                console.log("done-soldby")

                return "Serial Registered Successfully!";
            }
        })
    }catch{
        console.log("errorrrrrrrrrrrrrrrrrrrrr")
        return "err"
    }
}

function toJson(data){

    const result = {};
    let dataKey;
    data.split('\n').forEach(oneLine => {
      dataKey = oneLine.split(':');
      result[dataKey[0]] = dataKey[1];
    });

    return JSON.stringify(result);
}


module.exports = {register}