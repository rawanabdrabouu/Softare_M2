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
  
  // app.put("/api/v1/requests/senior/:requestId", async function(req, res){//req: status of request
  //   //all requests with status/req == on-going change their status value to either accepted or rejected
  //   //according to their current age

  //   //1st: check if current user is admin
  //   const user = await getUser(req);
  //   const roleidcurrent = db.from("users").select('roleid').where('email', user.email);
  //   if(roleidcurrent != 2){
  //     return res.status(400).send("user isn't authorised to do this action");
  //   }
  //   if(!req){
  //     return res.status(400).send("input isn't sent correctly");
  //   }
  //   nationalId = db.from("senior_requests").where('userid', user.id).select('nationalid');
  //   birthDate = nationalId.toString();
  //   birthDate = birthDate.substring(1);//ignore first number
  //   year = birthDate.substring(0,2);
  //   if(year <= 23)
  //     year = "20" + year;
  //   else
  //     year = "19" + year;
    
  //   month = birthDate.substring(2,4);
  //   day = birthDate.substring(4,6);
  //   actualBirthdate = day + '/' + month + '/' + year;
  //   age = 2023 - (year.Number());
  //   const newStatus = req.body.status;
  //   if(age > 60)
  //     db.from("senior_requests").where('userid', user.id).update({status: newStatus});
  //   else
  //     db.from("senior_requests").where('userid', user.id).update({status: 'rejected'});

  //   return res.status(200).send("Status has been updated");
  // });
};
