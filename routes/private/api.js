const { isEmpty, update, result, xor } = require("lodash");
const { v4 } = require("uuid");
const db = require("../../connectors/db");
const roles = require("../../constants/roles");
const { getSessionToken } = require("../../utils/session");
const { default: knex, Knex } = require("knex");
const { log } = require("async");
const { request } = require("express");

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
  app.get("/api/v1/users", async function (req, res) {
    try {
      const user = await getUser(req);
      // const {userid}=req.body
      const users = await db.select("*").from("users");

      return res.status(200).json(users);
    } catch (e) {
      return res.status(400).send("Could not get users");
    }
  });

  app.post("/api/v1/station", async function (req, res) {
    const stationanmeVal = req.body.stationname;
    const stationtype = req.body.stationtype;
    if (!stationanmeVal) {
      return res.status(401).send("stationa name is required");
    }
    if (!stationtype) {
      return res.status(401).send("stationa type is required");
    }
    try {
      const result = await db("stations")
        .insert({
          stationname: stationanmeVal,
          stationtype: stationtype,
          stationstatus: "new",
        })
        .returning("*");
      return res.status(200).send("added succesfully");
    } catch (e) {
      return res.status(500).send("error :" + e);
    }
  });

  app.put("/api/v1/password/reset", async function (req, res) {
    const user = await getUser(req);

    const newPassword = req.body.newPassword;

    if (!newPassword) {
      return res.status(400).send("new passwoes is required");
    }

    await db
      .from("users")
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

    await db
      .from("zones")
      .where("id", zoneId)
      .update({ price: price })
      .then(function () {
        return res.status(200).json({ message: "zone has been updated" });
      });
  });

  app.put("/api/v1/station/:stationID", async function (req, res) {
    const nestationname = req.body.stationname;
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

  app.put("/api/v1/station", async function (req, res) {
    const nestationname = req.body.nestationname;
    const stationid = req.body.stationid;

    if (!nestationname) {
      return res.status(500).send("error no data");
    }
    db.from("stations")
      .where("id", "=", stationid)
      .update({ stationname: nestationname })
      .then(function (rowsUpdated) {
        res.status(200).json({ message: "station name updated" });
      });
  });

  app.post("/api/v1/payment/subscription", async function (req, res) {
    const user = await getUser(req);
    const creditCardNumber = req.body.creditCardNumber;
    const holderName = req.body.holderName;
    const payedAmount = req.body.payedAmount;
    const subscType = req.body.subscType;
    const zoneId = req.body.zoneId;
    const userId = user.userid;

    if (
      !creditCardNumber ||
      !holderName ||
      !payedAmount ||
      !subscType ||
      !zoneId
    ) {
      return res.status(400).send("Error: Missing required field");
    }

    if (subscType == "annual") {
      nooftickets = 100;
    } else if (subscType == "quarterly") {
      nooftickets = 50;
    } else if (subscType == "monthly") {
      nooftickets = 10;
    }

    const subdata = {
      subtype: req.body.subscType,
      zoneid: req.body.zoneId,
      userid: user.userid,
      nooftickets: nooftickets,
    };

    const sub = await db("subsription")
      .where("subtype", "=", subscType)
      .where("zoneid", "=", zoneId)
      .where("nooftickets", "=", nooftickets)
      .insert(subdata);

      const subId= await db . from("subsription").select("id").where("userid",userId).first()
console.log(subId);
    const transaction = {
      amount: payedAmount,
      userid: userId,
      purchasedid :subId.id,
      purchasetype:"subscription"
    }


    const tran= await db.from("transactions")
    .insert(transaction).returning('*')

   
    return res.status(200).send("sub 100");
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
      status: "pending",
      userid: currentUserId,
      nationalid: req.body.nationalId,
    };
    try {
      const request = await db("senior_requests")
        .insert(newRequest)
        .returning("*");

      return res.status(200).send("request saved");
    } catch (e) {
      return res.status(400).send("Could not store the request");
    }
  });

  app.post("/api/v1/payment/ticket", async function (req, res) {
    const user = await getUser(req);
    const creditCardNumber = req.body.creditCardNumber;
    const holderName = req.body.holderName;
    const payedAmount = req.body.payedAmount;
    const origin = req.body.origin;
    const destination = req.body.destination;
    const tripDate = req.body.tripDate;

    const ticket = {
      origin: origin,
      destination: destination,
      userid: user.userid,
      subid: null,
      tripdate: tripDate,
    };

    const tickets = await db("tickets").insert(ticket).returning("*");
    if (tickets) {
      const indications = {
        amount: payedAmount,
        userid: user.userid,
        purchasedid: tickets[0].id,
        purchasetype: "ticket",
      };

      const transactions = await db("transactions")
        .insert(indications)
        .returning("*");
      if (!transactions) {
        return res.status(400).send("Could not store indications");
      }

      const purchasetype = await db
        .from("transactions")
        .select("purchasetype")
        .where("purchasedid", "=", tickets[0].id)
        .first();

      if (purchasetype.purchasetype == "subscription") {
        return res.status(400).send("Could not pay online");
      }

      if (user.isSenior) {
        const oldamount = payedAmount;
        await db
          .from("transactions")
          .where("purchasedid", "=", tickets[0].id)
          .update({ amount: payedAmount / 2 });
      }

      const adding_rides = {
        status: "upcoming",
        origin: origin,
        destination: destination,
        userid: user.userid,
        ticketid: tickets[0].id,
        tripdate: tripDate,
      };
      try {
        const request = await db("rides").insert(adding_rides).returning("*");
      } catch (e) {
        return res.status(400).send("Could not store rides");
      }

      return res.status(200).send("SUCCESSFULLY ADDED A RIDE");
    } else {
      return res.status(400).send("Could not store ticket");
    }
  });

  app.post("/api/v1/tickets/purchase/subscription", async function (req, res) {
    const user = await getUser(req);
    const subId = req.body.subId;
    const origin = req.body.origin;
    const destination = req.body.destination;
    const tripDate = req.body.tripDate;

    const indications = {
      amount: 0,
      userid: user.userid,
      purchasedid: subId,
      purchasetype: "subscription",
    };
    try {
      const request = await db("transactions")
        .insert(indications)
        .returning("*");
    } catch (e) {
      return res.status(400).send("Could not store indications");
    }

    const ticket = {
      origin: origin,
      destination: destination,
      userid: user.userid,
      subid: subId,
      tripdate: tripDate,
    };

    try {
      var request = await db("tickets").insert(ticket).returning("*");
    } catch (e) {
      return res.status(400).send("Could not store ticket");
    }

    const purchasetype = await db
      .from("transactions")
      .where("purchasedid", "=", subId);

    if (purchasetype[0].purchasetype !== "subscription") {
      return res.status(400).send("Could not pay online");
    }

    const adding_rides = {
      status: "upcoming",
      origin: origin,
      destination: destination,
      userid: user.userid,
      ticketid: request[0].id,
      tripdate: tripDate,
    };
    try {
      const request = await db("rides").insert(adding_rides).returning("*");
      return res.status(200).send("successfully added the ride!");
    } catch (e) {
      return res.status(400).send("Could not store rides");
    }

    const sub = await db.from("subsription").where("id", "=", subId);

    const subb = await db
      .from("subsription")
      .where("id", "=", subId)
      .update({ nooftickets: sub[0].nooftickets - 1 });
    return res.status(200).send("successfully added the ride!");
  });

  app.put("/api/v1/requests/senior/:requestId", async function (req, res) {
    //req: status of request
    //all requests with status/req == on-going change their status value to either accepted or rejected
    //according to their current age

    //1st: check if current user is admin
    const user = await getUser(req);
    if (!user.isAdmin) {
      return res.status(400).send("user isn't authorised to do this action");
    }
    if (!req) {
      return res.status(400).send("input isn't sent correctly");
    }

    const requestId = req.params.requestId;
    if (
      req.body.seniorStatus == "accepted" ||
      req.body.seniorStatus == "accept" ||
      req.body.seniorStatus == "approve" ||
      req.body.seniorStatus == "approved"
    ) {
      await db
        .from("senior_requests")
        .where("id", requestId)
        .update({ status: "accepted" });
      const newSeniorId = db
        .from("senior_requests")
        .where("id", requestId)
        .select("userid");
      await db.from("users").where("id", newSeniorId).update({ roleid: 3 });
      const oldamount = await db
        .from("transactions")
        .where("userid", newSeniorId)
        .select("amount")
        .first();
      await db
        .from("transactions")
        .where("userid", newSeniorId)
        .update({ amount: oldamount.amount / 2 });
      return res.status(200).send("status has been updated");
    } else if (
      req.body.seniorStatus == "rejected" ||
      req.body.seniorStatus == "reject"
    ) {
      db.from("senior_requests")
        .where("id", requestId)
        .update({ status: "rejected" })
        .then((status) => {
          return res.status(200).send("Status has been updated");
        })
        .catch((err) => {
          res
            .status(500)
            .send("error updating request with user id = " + user.id);
        });
    }
  });

  app.post("/api/v1/refund/:ticketId", async function (req, res) {
    //go to table refund requests and send a request for response
    const user = await getUser(req);
    const currentUserId = db
      .from("users")
      .select("id")
      .where("email", user.email);

    if (user.isAdmin)
      return res.status(400).send("An admin can't send a refund request");

    //check if user sent refund request for the same ticket
    const ticketId = req.params.ticketId;

    const refRequestExists = await db
      .select("*")
      .from("refund_requests")
      .where("userid", currentUserId)
      .where("ticketid", ticketId);
    if (!isEmpty(refRequestExists)) {
      return res.status(400).send("request has been sent before");
    }

    //check if it's a future dated ticket
    var tripDateDb = db
      .from("tickets")
      .select("tripdate")
      .where("id", ticketId);
    var stringTripDate = tripDateDb.toString();
    var tripYear = stringTripDate.substring(0, 4);
    var tripMonth = stringTripDate.substring(5, 7);
    var tripDay = stringTripDate.substring(8, 10);
    var tripDate = new Date(tripYear, tripMonth, tripDay);
    var myDate = new Date();
    var myMonth = myDate.getMonth() + 1;
    var myDay = myDate.getDay();
    var myYear = myDate.getFullYear();
    var myDate = new Date(myYear, myMonth, myDay);
    if (myDate > tripDate) {
      return res.status(400).send("ticket isn't future dated");
    }
    //transactions table to get refund amount
    const payPlan = db
      .from("transactions")
      .select("purchasetype")
      .where("userid", currentUserId);
    const payPlanStr = payPlan.toString();
    var amountPayed;
    if (payPlanStr.includes("subscription")) {
      amountPayed = 0;
    } else {
      amountPayed = await db
        .from("transactions")
        .select("amount")
        .where("purchasedid", ticketId)
        .first();
      console.log(amountPayed);
    }
    const newRefRequest = {
      status: "pending",
      userid: currentUserId,
      refundamount: amountPayed.amount,
      ticketid: ticketId,
    };
    try {
      const refRequest = await db("refund_requests")
        .insert(newRefRequest)
        .returning("*");

      return res.status(200).send("Request saved");
    } catch (e) {
      return res.status(400).send("Could not store the request");
    }
  });

  app.put("/api/v1/requests/refunds/:requestId", async function (req, res) {
    const user = await getUser(req);
    // const currentUserId = await db.from("users").select('id').where('email', user.email);
    const requestId = req.params.requestId;
    if (!req) {
      return res
        .status(400)
        .send("Couldn't send request, refund status wasn't sent correctly");
    }
    if (!user.isAdmin)
      return res
        .status(400)
        .send("A user can't approve/reject a refund request");

    const ticketId = await db
      .from("refund_requests")
      .where("id", requestId)
      .select("ticketid", "userid")
      .first();
    const subsid = await db
      .from("tickets")
      .where("id", ticketId.ticketid)
      .select("subid")
      .first();
    const payPlan = await db
      .from("transactions")
      .select("purchasetype")
      .where("purchasedid", ticketId.ticketid)
      .first();
    const payPlanStr = payPlan.purchasetype;

    if (
      req.body.refundStatus == "accepted" ||
      req.body.refundStatus == "accept" ||
      req.body.refundStatus == "approve" ||
      req.body.refundStatus == "approved"
    ) {
      await db
        .from("refund_requests")
        .where("userid", ticketId.userid)
        .where("ticketid", ticketId.ticketid)
        .update({ status: "accepted" });
      //tickets and rides table ha-delete menhom el ride el refunded
      //await db.from("tickets").del().where('id', ticketId).where('userid', currentUserId)
      await db
        .from("rides")
        .del()
        .where("ticketid", ticketId.ticketid)
        .where("userid", ticketId.userid);
      if (payPlanStr == "ticket") {
        await db
          .from("transactions")
          .del()
          .where("purchasedid", ticketId.ticketid);
      }
      //ADD 7TET ADDING TICKETS OF SUBSCRIPTION IF USER IS SUBSCRIBED LAW LAA YB2A 5ALAS
      if (payPlanStr.includes("subscription")) {
        const nooftickets = await db
          .from("subsription")
          .where("id", subsid.subid)
          .select("nooftickets")
          .first();
        const newnotickets = nooftickets.nooftickets;
        await db
          .from("subsription")
          .where("id", subsid.subid)
          .update({ nooftickets: newnotickets + 1 })
          .then((status) => {
            res.status(200).send("refund request status is updated");
          })
          .catch((err) => {
            res
              .status(400)
              .send("error updating request with id = " + requestId);
          });
      } else {
        res.status(200).send("refund request status is updated");
      }
    } else if (
      req.body.refundStatus == "rejected" ||
      req.body.refundStatus == "reject"
    ) {
      await db
        .from("refund_requests")
        .where("id", requestId)
        .update({ status: "rejected" })
        .then((status) => {
          return res.status(200).send("Status has been updated");
        });
    }
  });

  app.delete("/api/v1/route/:routeId", async function (req, res) {
    const routeId = req.params.routeId;
    const fromstation = await db
      .from("routes")
      .where("id", routeId)
      .select("fromstationid")
      .first();

    const tostationid = await db
      .from("routes")
      .where("id", routeId)
      .select("tostationid")
      .first();
    const stationfrom = await db
      .from("stations")
      .where("id", fromstation.fromstationid)
      .select("stationposition")
      .first();
    const stationto = await db
      .from("stations")
      .where("id", tostationid.tostationid)
      .select("stationposition")
      .first();
    const secondDirec = await db
      .from("routes")
      .select("id")
      .where("fromstationid", tostationid.tostationid)
      .where("tostationid", fromstation.fromstationid)
      .first();
    if (!secondDirec) {
      //no second route yb2a el route el ana 3ayza amsa7o howa el wa7eed el mawgood
      if (
        stationfrom.stationposition == "start" &&
        stationto.stationposition == "middle"
      ) {
        await db
          .from("stations")
          .where("id", tostationid.tostationid)
          .update({ stationposition: "start" });
        await db
          .from("stations")
          .where("id", fromstation.fromstationid)
          .update({ stationposition: null });
        await db
          .from("stations")
          .where("id", fromstation.fromstationid)
          .update({ stationtype: "new" });
        await db.from("routes").del().where("id", "=", routeId);
        return res.status(200).send("Route deleted");
      }
    } else {
      //el ana 3ayza amsa7o is the 2nd route
      if (
        stationfrom.stationposition == "start" &&
        (stationto.stationposition == "middle" ||
          stationto.stationposition == "end")
      ) {
        await db
          .from("stations")
          .where("stationposition", "end")
          .update({ stationposition: "start" });
        await db.from("routes").del().where("id", routeId);
        return res.status(200).send("Route deleted");
      } else if (
        (stationfrom.stationposition == "middle" ||
          stationfrom.stationposition == "end") &&
        stationto.stationposition == "start"
      ) {
        await db.from("routes").del().where("id", routeId);
        return res.status(200).send("Route deleted");
      }
    }
  });

  app.delete("/api/v1/station/:stationID", async function (req, res) {
    const stationID = req.params.stationID;

    const station = await db.from("stations").where("id", stationID).first();

    if (!station) {
      return res.status(404).send("station not found !!");
    }
    if (station.stationposition == "start") {
      const totation = await db
        .from("routes")
        .where("fromstationid", stationID)
        .first();

      await db
        .from("stations")
        .where("id", totation.tostationid)
        .update({ stationposition: "start" });

      await db.from("stations").where("id", stationID).del();

      return res.status(200).send("deleted");
    } else if (station.stationposition == "end") {
      const fromStation = await db
        .from("routes")
        .where("tostationid", stationID)
        .first();

      await db
        .from("stations")
        .where("id", fromStation.fromstationid)
        .update({ stationposition: "end" });

      await db.from("stations").where("id", stationID).del();
      return res.status(200).send("deleted");
    } else if (station.stationposition == "middle") {
      if (station.stationtype == "normal") {
        const fromstations = await db
          .select("*")
          .from("routes")
          .where("fromstationid", station.id); // 2

        // 1 - 3
        if (fromstations && fromstations.length == 2) {
          const s1 = fromstations[0].tostationid; // 1
          const s2 = fromstations[1].tostationid; // 3

          const r1 = await db("routes")
            .insert({
              routename: "hi" + s1 + s2,
              fromstationid: s1,
              tostationid: s2,
            })
            .returning("id"); //1 -3

          const r2 = await db("routes")
            .insert({
              routename: "hi" + s2 + s1,
              fromstationid: s2,
              tostationid: s1,
            })
            .returning("id"); // 3-1

          const stationroute = await db("stationroutes")
            .insert([
              { stationid: s1, routeid: r1 },
              { stationid: s2, routeid: r1 },
              { stationid: s1, routeid: r2 },
              { stationid: s2, routeid: r2 },
            ])
            .returning("*")
            .toString();

          await db.from("stations").where("id", stationID).del();
          return res.status(200).send("deleted");
        } else {
          return res.status(401).send("cant find station");
        }
      } else if (station.stationtype == "transfer") {
        const fromstations = await db
          .select("*")
          .from("routes")
          .where("fromstationid", station.id);

        var newStationtobemeddel = null;
        if (fromstations && fromstations.length > 0) {
          const replaceStation = fromstations[0];
          newStationtobemeddel = replaceStation.tostationid;
          for (let i = 1; i < fromstations.length; i++) {
            const st = fromstations[i];

            const r1data = {
              routename: "hi" + replaceStation.tostationid + st.tostationid,
              fromstationid: replaceStation.tostationid,
              tostationid: st.tostationid,
            };
            console.log(r1data);
            const r1 = await db("routes").insert(r1data).returning("id"); //1 -3

            const r2data = {
              routename: "hi" + st.tostationid + replaceStation.tostationid,
              fromstationid: st.tostationid,
              tostationid: replaceStation.tostationid,
            };
            console.log(r2data);

            const r2 = await db("routes").insert(r2data).returning("id"); // 3-1

            const stationroute = await db("stationroutes")
              .insert([
                { stationid: st.id, routeid: r1 },
                { stationid: replaceStation.tostationid, routeid: r1 },
                { stationid: st.id, routeid: r2 },
                { stationid: replaceStation.tostationid, routeid: r2 },
              ])
              .returning("*")
              .toString();
          }
          await db.from("stations").where("id", stationID).del();
          await db
            .from("stations")
            .where("id", newStationtobemeddel)
            .update({ stationtype: "transfer" });
          return res.status(200).send("deleted");
        }
      }
    }
  });

  app.post(
    "/api/v1/tickets/price/:originId/:destinationId",
    async function (req, res) {
      const originId = req.params.originId;
      const destinationId = req.params.destinationId;
      const routes = await db
        .from("routes")
        .select("fromstationid", "tostationid");

      let retult = getRouteStation(routes, originId, destinationId);
      if (result.length <= 9) {
        await db.from("zones").select("price").where("id", 1);
      } else if (result.length <= 16) {
        await db.from("zones").select("price").where("id", 2);
      } else if (result.length > 16) {
        await db
          .from("zones")
          .select("price")
          .where("id", 3)
          .then(function () {
            return res.status(200).json({ message: "zone has been updated" });
          });
      } else {
        return res.status(400).send("error: pls enter price");
      }
    }
  );

  function getRouteStation(routes, from, to) {
    let originId = parseInt(from);
    let destinationId = parseInt(to);

    let visited = new Set();
    visited.add(originId);
    let shortestRoute = [];
    DFS(originId, destinationId, [], visited);
    return shortestRoute;

    function DFS(currStationID, destinationId, inroute, visited) {
      if (currStationID === destinationId) {
        if (
          shortestRoute.length === 0 ||
          shortestRoute.length > inroute.length
        ) {
          shortestRoute = [...inroute];
        }
        return;
      }

      let nextStations = routes
        .map((st) =>
          st.fromstationid === currStationID && !visited.has(st.tostationid)
            ? st
            : undefined
        )
        .filter((st) => st !== undefined);

      for (let nextStation of nextStations) {
        visited.add(nextStation.tostationid);
        DFS(
          nextStation.tostationid,
          destinationId,
          [...inroute, nextStation],
          visited
        );
        visited.delete(nextStation.tostationid);
      }
    }
  }
  app.post("/api/v1/route", async function (req, res) {
    newStationId = req.body.newStationId;

    connectedStationId = req.body.connectedStationId;

    routeName = req.body.routeName;

    if (!newStationId || !connectedStationId || !routeName) {
      return res.status(400).send("Missing Required Parameters");
    }
    // try {
    const route = await db("routes")
      .insert({
        routename: routeName,
        fromstationid: connectedStationId,
        tostationid: newStationId,
      })
      .returning("*");

    return res.status(200).json(route);
    // } catch (e) {
    return res.status(500).json("error : Route Can't be created");
    //  }
  });
  app.put("/api/v1/route/:routeId", async function (req, res) {
    try {
      const routeName = req.body.routeName;

      const routeId = req.params.routeId;
      if (!routeName) {
        return res.status(400).send("Missing Required Parameter");
      }
      const update = await db
        .from("routes")
        .where({ id: routeId })
        .update({ routename: routeName });
      if (update == 0) {
        return res.status(400).send("Route does not exist");
      }
      const updatedRoute = await db
        .from("routes")
        .where({ id: routeId })
        .first();
      return res.status(200).json(updatedRoute);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
  app.put("/api/v1/ride/simulate", async function (req, res) {
    const user = await getUser(req);
    const originn = req.body.originn;
    const destinationn = req.body.destinationn;
    const tripDate = req.body.tripDate;

    if (!originn || !destinationn || !tripDate) {
      return res.status(400).send("Missing Required Parameters");
    }

    await db.from("rides").where({
      userid: user.id,
      origin: originn,
      destination: destinationn,
      tripdate: tripDate
    }).update(
      { status: "completed" })
    return res.status(200).send('Ride Can Start');
  }

  );

  //------------------------------------BONUS-------------------------------------------------
  //check 3ala table tickets kolaha:
  //1.get origin  w destination
  //2.compare origin w destination bel stationname column in stations table law mawgood yb2a not deleted
  //3.law mesh mawgood yb2a copy request refund api
  //req: null
  app.post('/api/v1/checkdelete', async function (req, res){
    const user = await getUser(req);
    const ticketinfo = await db.from('tickets').select('*')
    const stationinfo = await db.from('stations').select('stationname')
    const routeinfo = await db.from('routes').select('routename')
    var deleted = false;
    // const x = db.forEach()
    console.log(ticketinfo)
    ticketinfo.forEach(ticket => async function (ticket) {
      var origin = ticket.origin;
      var destination = ticket.destination;
      stationinfo.forEach(station => async function (stationname) {
        var stationname = stationname.stationname;
        if(origin == stationname || destination == stationname){
          deleted = false;
        }else{
          deleted = true;
          const amount = await db.from('transactions').select('amount').where('userid', user.userid).where('purchasedid', ticket.id)
          if(deleted){
            const newRequest = {
              status: "pending",
              userid: user.userid,
              refundamount: amount,
              ticketid: ticket.id
            };
            try {
              const request = await db("refund_requests")
                .insert(newRequest)
                .returning("*");

              return res.status(200).send("request saved");
            } catch (e) {
              console.log(e.message);
              return res.status(400).send("Could not store the request");
            }
          }
        }
      });
      routeinfo.forEach(route => async function (routename) {
        var routename = routename.routename;
        if(routename == routename){
          deleted = false;
        }else{
          deleted = true;
          const amount = await db.from('transactions').select('amount').where('userid', user.userid).where('purchasedid', ticket.id)
          if(deleted){
            const newRequest = {
              status: "pending",
              userid: user.userid,
              refundamount: amount,
              ticketid: ticket.id
            };
            try {
              const request = await db("refund_requests")
                .insert(newRequest)
                .returning("*");

              return res.status(200).send("request saved");
            } catch (e) {
              console.log(e.message);
              return res.status(400).send("Could not store the request");
            }
          }
        }
      });
  });

    return res.status(200).send("request saved");

  });
};
