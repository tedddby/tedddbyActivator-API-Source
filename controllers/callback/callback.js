const mysql = require("mysql");
const env = require("dotenv");
const path = require("path");
env.config({
    path:"./secret.env"
})

const envValue = process.env;

const db = mysql.createConnection({
    host:envValue.dbHost,
    database:envValue.dbName,
    user:envValue.dbUser,
    password:envValue.dbPassword
})

db.connect((err) => {
    if(err){
        console.log(err);
    }
})

const Main = (req, res) => {
    if(req.query.q && req.query.v){
    let query = req.query.q;
    let version = req.query.v;

    const currentVersion = "5.3";

    switch(query){
        case "twitter" :
            return res.redirect("https://twitter.com/realTedddby")
        break;

        case "check4update" :
            if(version == currentVersion){
                var data = Buffer.from("NoUpdate").toString('base64');
                return res.status(200).send(data);
            }else{
                var data = Buffer.from("New update released. V5.03! \nUpdate has already started downloading on your browser. \n\n\nThank you for being a tedddby customer. \nHave a nice day.").toString('base64');
                return res.status(200).send(data);
            }
        break;

        case "downloadUpdate" :
            const updatePath = path.join(__dirname, "tedddbyActivator-Version 5.3.zip");

            if(version == currentVersion){
                return res.send("There is no update!");
            }else{
               return res.redirect("https://tedddby.com/tedddbyActivator.rar");
            }
        break;
    }
}else{
    return res.status(401).json({
        err:"Invalid Request"
    })
}
}

const SerialCheck = (req, res) => {

    const serial = req.originalUrl.replace("/callback/serialCheck/", "");

    if(serial.length != 12 || serial.includes("/") || serial.includes(":") || serial.includes("-")){
        return res.json({error:"Invalid Serial Number"});
    }

    if(serial == "" || serial == null){
        return res.json({error:"No Serial Number Provided"});
    }

    const b64Encode = (data) => {
        return Buffer.from(data).toString("base64");
    }

    try{

const final = (status) => {
   switch(status){
       case "not_registered" :
           return b64Encode(JSON.stringify({
               status:b64Encode(status)
           }))
        break;

        case "registered_gsm" :
            return b64Encode(JSON.stringify({
                activation:b64Encode("https://api.v2.tedddby.com/gsm/activate"),
                records:b64Encode("https://api.v2.tedddby.com/gsm/records"),
                status:b64Encode(status)
            }))
        break;

        case "registered_meid" :
            return b64Encode(JSON.stringify({
                activation:b64Encode("https://api.v2.tedddby.com/meid/activate"),
                records:b64Encode("https://api.v2.tedddby.com/meid/records"),
                status:b64Encode(status)
            }))
        break;

        case "registered_carrier" :
            return b64Encode(JSON.stringify({
                activation:b64Encode("https://api.v2.tedddby.com/carrier/chain"),
                status:b64Encode(status)
            }))
        break;

        case "registered_mdm" :
            return b64Encode(JSON.stringify({
                activation:b64Encode("https://api.v2.tedddby.com/mdm/activate"),
                status:b64Encode(status)
            }))
        break;

        case "blacklisted" :
            return b64Encode(JSON.stringify({
                status:b64Encode(status)
            }))
        break;

        default :
            return b64Encode(JSON.stringify({
                status:b64Encode("unknown")
            }))
        break;
   }
   }

        db.query("SELECT * FROM serials WHERE serial = ?", [serial], (err, resu) => {
            if(err){
                console.log("Database err - Serial Check");
                return res.status(200).send("Server Fatal Error, Please Try Again Later");
            }

            if(resu && resu != ""){
				
				var finalRes;

                switch(resu[0].service){
                    case "GSM Bypass" :
                        finalRes = final("registered_gsm");
                    break;

                    case "Carrier Bypass" :
                        finalRes = final("registered_carrier");
                    break;

                    case "MDM Bypass" :
                        finalRes = final("registered_mdm");
                    break;

                    case "MEID Bypass" :
                        finalRes = final("registered_meid");
                    break;

                    default:
                        finalRes = final("unknown");
                    break;
                }

                return res.status(200).send(finalRes);
                        
            }else{
                return res.status(200).send(final("not_registered"));
            }
        });
    }catch(e){
        console.log(e);
        return res.status(200).send("Server Fatal Error Try Again Later");
    }
}

module.exports = {Main, SerialCheck}