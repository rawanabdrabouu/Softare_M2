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
//commment
module.exports = function (app) {
  // example
  app.get("/api/v1/users", async function (req, res) {
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

    await db.from("users").where("email", user.email).update({ password: newPassword })
    return res.status(200).send('passsword  updated') 
  })


  app.put('/api/v1/zones' , async function (req, res ){
    //const user = await getUser(req);
    
    const zoneId = req.body.zoneId;
    const price = req.body.price;

    if(!zoneId){
      return res.status(400).send("error: pls enter zone id");
    }
    if(zoneId>3){
      return res.status(400).send("error: zone not found");
    }
    db.from('zones')
    .where('id' ,zoneId)
    .update({price : price})
    .then(function(rowsUpdated) {
      res.status(200).json({ message: '${rowsUpdated}  updated' });
  });

  });


  app.put("/api/v1/station", async function (req, res) {
    const nestationname = req.body.nestationname;
    const stationid = req.body.stationid;
   
    if ((!nestationname) ) {
      return res.status(500).send("error no data");
    }
      db.from('stations')
      .where('id','=',stationid)
      .update({ stationname: nestationname })
      .then(function(rowsUpdated) {
       res.status(200).json({ message: 'station name updated' })
});
})
  
app.post("/api/v1/senior/request", async function(req, res){//req: nationalID
  //check if id is empty
  if(!req){
    return res.status(400).send("Could send request, the id wasn't sent correctly");
  }
  //check if it is a user not an admin
  const user = await getUser(req);
  const currentUserId = db.from("users").select('id').where('email', user.email);
  if(user.isAdmin)
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
    status: 'pending',
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

app.put("/api/v1/requests/senior/:requestId", async function(req, res){//req: status of request
  //all requests with status/req == pending change their status value to either accepted or rejected
  //according to their current age

  //1st: check if current user is admin
  const user = await getUser(req);
  if(!user.isAdmin){
    return res.status(400).send("user isn't authorised to do this action");
  }
  if(!req){
    return res.status(400).send("input isn't sent correctly");
  }

  const requestId = req.params.requestId
  if(req.body.seniorStatus == 'accepted' || req.body.seniorStatus == 'accept'){
    await db.from("senior_requests").where('id', requestId).update({'status': 'accepted'})
    const newSeniorId = db.from("senior_requests").where('id', requestId).select('userid')
    await db.from("users").where('id', newSeniorId).update({'roleid': 3})
    const oldamount = await db.from("transactions").where('userid', newSeniorId).select('amount').first()
    // console.log('old amount is ', oldamount)
    await db.from("transactions").where('userid', newSeniorId).update({'amount': oldamount.amount/2})   
    return res.status(200).send("status has been updated")

    }else if(req.body.seniorStatus == 'rejected' || req.body.seniorStatus == 'reject'){
    db.from("senior_requests").where('id', requestId).update({'status': 'rejected'})
    .then(status => {
      return res.status(200).send("Status has been updated");
    })
    .catch(err => {
      res.status(500).send("error updating request with user id = " + user.id);
    });
  }
});

app.post("/api/v1/refund/:ticketId", async function(req, res){
  //go to table refund requests and send a request for response
  const user = await getUser(req);
  const currentUserId = db.from("users").select('id').where('email', user.email);

  if(user.isAdmin)
    return res.status(400).send("An admin can't send a refund request");

  //check if user sent refund request for the same ticket
  const ticketId = req.params.ticketId.substring(1)
  const refRequestExists = await db
  .select("*")
  .from("refund_requests")
  .where("userid", currentUserId)
  .where("ticketid", ticketId);
  if (!isEmpty(refRequestExists)) {
    return res.status(400).send("request has been sent before");
  }

  //check if it's a future dated ticket
  var tripDateDb = db.from("tickets").select('tripdate').where('id', ticketId);
  var stringTripDate = tripDateDb.toString()
  var tripYear = stringTripDate.substring(0, 4)
  var tripMonth = stringTripDate.substring(5, 7)
  var tripDay = stringTripDate.substring(8, 10)
  var tripDate = new Date(tripYear, tripMonth, tripDay)
  var myDate = new Date();
  var myMonth = myDate.getMonth()+1;
  var myDay = myDate.getDay();
  var myYear = myDate.getFullYear();
  var myDate = new Date(myYear, myMonth, myDay);
  if(myDate < tripDate){
    return res.status(400).send("ticket isn't future dated");
  }
  //transactions table to get refund amount
  const payPlan = db.from("transactions").select('purchasetype').where('userid', currentUserId);
  const payPlanStr = payPlan.toString()
  if(payPlanStr.includes('subscription')){
    var amountPayed = 0;
  }else{
    var amountPayed = db.from("transactions").select('amount').where('userid', currentUserId);
  }
  const newRefRequest = {
    status: 'pending',
    userid: currentUserId,
    refundamount: amountPayed,
    ticketid: ticketId,
  };
  try {
    const refRequest = await db("refund_requests").insert(newRefRequest).returning("*");

    return res.status(200).json(refRequest);
  } catch (e) {
    console.log(e.message);
    return res.status(400).send("Could not store the request");
  }
});

app.put("/api/v1/requests/refunds/:requestId", async function(req, res){
  const user = await getUser(req);
  // const currentUserId = await db.from("users").select('id').where('email', user.email);
  
  if(!req){
    return res.status(400).send("Couldn't send request, refund status wasn't sent correctly");
  }
  if(!user.isAdmin)
    return res.status(400).send("A user can't approve/reject a refund request");

  const requestId = req.params.requestId
  const ticketId = await db.from("refund_requests").where('id', requestId).select('ticketid','userid').first()
  const subsid = await db.from("tickets").where('id', ticketId.ticketid).select('subid').first();
  const payPlan = await db.from("transactions").select('purchasetype').where('purchasedid',ticketId.ticketid).first();
  const payPlanStr = payPlan.purchasetype

  if(req.body.refundStatus == 'accepted' || req.body.refundStatus == 'accept'){
    await db.from("refund_requests").where('status', 'pending').update({status: 'accepted'})
      //tickets and rides table ha-delete menhom el ride el refunded
    //await db.from("tickets").del().where('id', ticketId).where('userid', currentUserId)
    await db.from("rides").del().where('ticketid', ticketId.ticketid).where('userid', ticketId.userid)
    if(payPlanStr == 'ticket'){
      await db.from("transactions").del().where('purcchaseid', ticketId.ticketid)
    }
    //ADD 7TET ADDING TICKETS OF SUBSCRIPTION IF USER IS SUBSCRIBED LAW LAA YB2A 5ALAS
    if(payPlanStr.includes('subscription')){
      console.log('here')
      const nooftickets = await db.from("subsription").where('id', subsid.subid).select('nooftickets').first()
      const newnotickets = nooftickets.nooftickets 
      await db.from("subsription").where('id', subsid.subid).update({'nooftickets': newnotickets+ 1})
      .then(status => {
        res.status(200).send("refund request status is updated");
      })
      .catch(err => {
        res.status(400).send("error updating request with id = " + requestId);
      })
    }else{
      res.status(200).send("refund request status is updated");
    }
  }else if(req.body.status == 'rejected' || req.body.status == 'reject'){
    await db.from("refund_requests").where('id', requestId).update({'status': 'rejected'})
    .then(status =>{
      return res.status(200).send("Status has been updated");
    })
  }

})

};
