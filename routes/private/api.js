const { isEmpty, update } = require("lodash");
const { v4 } = require("uuid");
const db = require("../../connectors/db");
const roles = require("../../constants/roles");
const { getSessionToken } = require("../../utils/session");
const { default: knex, Knex } = require("knex");

const getUser = async function (req) {
  const sessionToken = getSessionToken(req);
  if (!sessionToken) {
    return res.status(301).redirect("/");
  }

  console.log(sessionToken);
  const user = await db
    .select("*")
    .from("sessions")
    .where("token", sessionToken)
    .innerJoin("users", "sessions.userid", "users.id")
    .innerJoin("roles", "users.roleid", "roles.id")
    .first();

  user.isNormal = user.roleid === roles.user;
  user.isAdmin = user.roleid === roles.admin;
  user.isSenior = user.roleid === roles.senior;
  return user;
};

module.exports = function (app) {
  // example
  app.put("/users", async function (req, res) {
    try {
      const user = await getUser(req);
      // const {userid}=req.body
      console.log("hiiiiiiiiiii");
      const users = await db.select("*").from("users");

      return res.status(200).json(users);
    } catch (e) {
      console.log(e.message);
      return res.status(400).send("Could not get users");
    }
  });


  app.post("/api/v1/station", async function (req, res) {
    const stationanmeVal = req.body.stationname;

    if (!stationanmeVal) {
      return res.status(401).send("stationa name is required");
    }
    try {
      const result = await db("stations")
        .insert({ stationname: stationanmeVal })
        .returning("*");
      return res.status(200).send("added succesfully");
    } catch (e) {
      return res.status(500).send("error :");
    }
  });



  app.put("/api/v1/password/reset", async function (req, res) {
    const user = await getUser(req);

    const newPassword = req.body.newPassword;

    if (!newPassword) {
      return res.status(400).send("new passwoes is required");
    }

    db.from("users")
      .where("email", user.email)
      .update({ password: newPassword });

    return res.status(200).send("Password has been updsatd");
  });


  app.put('/api/v1/zones', async function (req, res) {
    //const user = await getUser(req);

    const zoneId = req.body.zoneId;
    const price = req.body.price;

    if (!zoneId) {
      return res.status(400).send("error: pls enter zone id");
    }
    
    db.from('zones')
      .where('id', zoneId)
      .update({ price: price })
      .then(function (rowsUpdated) {
        res.status(200).json({ message: '${rowsUpdated}  updated' });
      });

  });


  app.put("/api/v1/station", async function (req, res) {
    const nestationname = req.body.nestationname;
    const stationid = req.body.stationid;

    if ((!nestationname)) {
      return res.status(500).send("error no data");
    }
    db.from('stations')
      .where('id', '=', stationid)
      .update({ stationname: nestationname })
      .then(function (rowsUpdated) {
        res.status(200).json({ message: 'station name updated' })
      });
  })



  app.put("/api/v1/station", async function (req, res) {
    const nestationname = req.body.nestationname;
    const stationid = req.body.stationid;

    if ((!nestationname)) {
      return res.status(500).send("error no data");
    }
    db.from('stations')
      .where('id', '=', stationid)
      .update({ stationname: nestationname })
      .then(function (rowsUpdated) {
        res.status(200).json({ message: 'station name updated' })
      });
  })


  
  app.post('/api/v1/payment/subscription', async function (req, res) { 
    const user =  await getUser(req);
    const creditCardNumber = req.body.creditCardNumber;
    const holderName = req.body.holderName;
    const payedAmount = req.body.payedAmount; 
    const subscType = req.body.subscType;
    const zoneId = req.body.zoneId;
    const userId = user.userid;

    

    if ( !creditCardNumber || !holderName || !payedAmount || !subscType || !zoneId ) {
      return res.status(400).send("Error: Missing required field");
    }

       
    if(subscType == "annual"){
      nooftickets=100;
    }else if(subscType=="quarterly"){
      nooftickets=50;
    }else if(subscType=="monthly"){
      nooftickets=10;
    }

    const subdata={
      subtype:req.body.subscType,
      zoneid:req.body.zoneId,
      userid:user.userid,
      nooftickets
    }

    console.log(subdata);

    const sub= await db("subsription")
    .where("subtype",'=',subscType)
    .where("zoneid",'=',zoneId)
    .where("nooftickets",'=',nooftickets)
    .insert(subdata)
    if(sub){
      if(nooftickets ==100){
        return res.status(200).send("sub 100");
      }
    }
  });

 


  app.post("/api/v1/senior/request", async function (req, res) {//req: nationalID
    //check if id is empty
    if (!req) {
      return res.status(400).send("Could send request, the id wasn't sent correctly");
    }
    //check if it is a user not an admin
    const user = await getUser(req);
    const currentUserId = db.from("users").select('id').where('email', user.email);
    if (user.isAdmin)
      return res.status(400).send("An admin can't send a senior request");
    //check if senior request already exists in table
    const requestExists = await db
      .select("*")
      .from("senior_requests")
      .where("nationalid", req.body.nationalId)
      .where("userid", user.id);
    if (!isEmpty(requestExists)) {
      return res.status(400).send("request has been sent before");
    }
    //check if same user has already enterred their nationalID
    const userIdExists = await db
      .select("*")
      .from("senior_requests")
      .where("userid", currentUserId);
    if (!isEmpty(userIdExists))
      return res.status(400).send("This user has already submitted a request before");


    //create new request in table

    const newRequest = {
      status: 'on-going',
      userid: currentUserId,
      nationalid: req.body.nationalId,
    };
    try {
      const request = await db("senior_requests").insert(newRequest).returning("*");

      return res.status(200).json(request);
    } catch (e) {
      console.log(e.message);
      return res.status(400).send("Could not store the request");
    }
  });

  app.post("/api/v1/payment/ticket", async function (req, res) {
    const user =  await getUser(req);
    const purchasedId=req.body.purchasedId;
    const creditCardNumber = req.body.creditCardNumber;
    const holderName = req.body.holderName;
    const payedAmount = req.body.payedAmount; 
    const origin = req.body.origin;
    const destination = req.body.destination;
    const tripDate = user.tripDate;
    console.log(purchasedId)
    const purchasetype = await db.from("transactions")
      .select("purchasetype")
      .where("purchasedid", "=",purchasedId).first();
      console.log(purchasetype);
    

      
    if(purchasetype.purchasetype == "subscription")  {
      return res.status(400).send("Could not pay online");
    }

    if(user.isSenior){
      const oldamount= payedAmount;
      await db.from("transactions").where("purchasedid",'=',purchasedId).update({amount:payedAmount/2});
    }

    

    const indications = {
      amount:payedAmount,
      userid: user.userid,
      purchasedid:purchasedId,
      purchasetype: purchasetype.purchasetype
    };
   
    try {
      const request = await db("transactions").insert(indications).returning("*");
    }catch (e) {
      console.log(e.message);
      return res.status(400).send("Could not store indications");
    }   

    const adding_rides = {
      status:"upcoming",
      origin : req.body.origin,
      destination : req.body.destination,
      userid: user.userid,
      ticketid: req.body.purchasedId,
      tripdate: req.body.tripDate
    };
    try {
      const request = await db("rides").insert(adding_rides).returning("*");
    }catch (e) {
      console.log(e.message);
      return res.status(400).send("Could not store rides");
    } 

    return res.status(200).send("SUCCESSFULLY ADDED A RIDE");

  });

  app.post("/api/v1/tickets/purchase/subscription", async function (req, res) {
    
    const user =  await getUser(req);
    const subId = req.body.subId;
    const origin = req.body.origin;
    const destination = req.body.destination;
    const tripDate = req.body.tripDate;
    console.log(subId)


    const purchasetype = await db.from("transactions")
      .where("purchasedid","=", subId);
      

      console.log(purchasetype[0].purchasetype)
     if(purchasetype[0].purchasetype!=='subscription')  {
        return res.status(400).send("Could not pay online");
      }
     


    const indications = {
      amount:0,
      userid: user.userid,
      purchasedid: subId,
      purchasetype: purchasetype[0].purchasetype
    };
    try {
      const request = await db("transactions").insert(indications).returning("*");
 
    }catch (e) {
      console.log(e.message);
      return res.status(400).send("Could not store indications");
    } 
    const adding_rides = {
      status:"upcoming",
      origin : origin,
      destination : destination,
      userid: user.userid,
      ticketid:subId,
      tripdate: tripDate
    };
    try {
      const request = await db("rides").insert(adding_rides).returning("*");
       res.status(200).send("successfully added the ride!");
    }catch (e) {
      console.log(e.message);
       res.status(400).send("Could not store rides");
    } 

    
    const sub = await db.from("subsription")
      .where("id","=", subId)
      console.log(sub[0].nooftickets)
 
    const subb= await db.from("subsription")
     .where("id","=", subId).update ({nooftickets:sub[0].nooftickets-1
        }); 

    
  });
};
