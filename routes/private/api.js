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
      .update({ password: newPassword })
      .then(function () {
        res.status(200).json({ message: "passsord  updated" });
      });
  });

  app.put("/api/v1/zones/:zoneId", async function (req, res) {
    //const user = await getUser(req);

    const zoneId = req.params.zoneId;
    const price = req.body.price;

    if (!price) {
      return res.status(400).send("error: pls enter price");
    }

    db.from("zones")
      .where("id", zoneId)
      .update({ price: price })
      .then(function () {
        res.status(200).json({ message: "zone has been updated" });
      });
  });

  app.put("/api/v1/station/:stationID", async function (req, res) {
    const nestationname = req.body.nestationname;
    const stationid = req.params.stationID;

    if (!nestationname) {
      return res.status(500).send("error no data");
    }

    db.from("stations")
      .where("id", "=", stationid)
      .update({ stationname: nestationname })
      .then(function () {
        res.status(200).json({ message: "station name updated" });
      });
  });

  app.delete("/api/v1/station/:stationID", async function (req, res) {
    console.log(req);
    const stationid = req.params.stationID;

    db.from("stations")
      .del()
      .where("id", "=", stationid)
      .then(function () {
        fromstationid = db
          .from("routes")
          .where("fromstationid", stationid)
          .returning("*");

        tostationid = db
          .from("routes")
          .where("tostationid", stationid)
          .insert({ tostationid: fromstationid.tostationid });

        db.from("stationroutes").del().where("stationid", "=", stationid);
      })
      .then(function (deleted) {
        if (deleted) {
          res.status(200).json({ message: "station  deleted" });
        }
        res.status(404).json({ message: "station  not found" });
      });
  });

  app.post("/api/v1/senior/request", async function (req, res) {
    //req: nationalID
    //check if id is empty
    if (!req) {
      return res
        .status(400)
        .send("Could send request, the id wasn't sent correctly");
    }
    //check if it is a user not an admin
    const user = await getUser(req);
    const currentUserId = db
      .from("users")
      .select("id")
      .where("email", user.email);
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
      return res
        .status(400)
        .send("This user has already submitted a request before");

    //create new request in table

    const newRequest = {
      status: "on-going",
      userid: currentUserId,
      nationalid: req.body.nationalId,
    };
    try {
      const request = await db("senior_requests")
        .insert(newRequest)
        .returning("*");

      return res.status(200).json(request);
    } catch (e) {
      console.log(e.message);
      return res.status(400).send("Could not store the request");
    }
  });

  app.get(
    "/api/v1/tickets/price/:originId & :destinationId",
    async function (req, res) {
      const originId = req.params.originId;
      const destinationId = req.params.destinationId;
    }
  ); 
};
