const { isEmpty, update, result, xor } = require("lodash");
const { v4 } = require("uuid");
const db = require("../../connectors/db");
const roles = require("../../constants/roles");
const { getSessionToken } = require("../../utils/session");
const { default: knex, Knex } = require("knex");
const { log } = require("async");

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
      console.log(e.message);
      return res.status(400).send("Could not store the request");
    }
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
      // console.log('old amount is ', oldamount)
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
    if (myDate < tripDate) {
      return res.status(400).send("ticket isn't future dated");
    }
    //transactions table to get refund amount
    const payPlan = db
      .from("transactions")
      .select("purchasetype")
      .where("userid", currentUserId);
    const payPlanStr = payPlan.toString();
    if (payPlanStr.includes("subscription")) {
      var amountPayed = 0;
    } else {
      var amountPayed = db
        .from("transactions")
        .select("amount")
        .where("userid", currentUserId);
    }
    const newRefRequest = {
      status: "pending",
      userid: currentUserId,
      refundamount: amountPayed,
      ticketid: ticketId,
    };
    try {
      const refRequest = await db("refund_requests")
        .insert(newRefRequest)
        .returning("*");

      return res.status(200).send("Request saved");
    } catch (e) {
      console.log(e.message);
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
          .where("purcchaseid", ticketId.ticketid);
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

        if (fromstations && fromstations.length > 0) {
          fromstations.forEach(async (st) => {
            const stationroutes = await db
              .select("*")
              .from("stationroutes")
              .where("stationid", st.tostationid);
            console.log(stationroutes);
            if (stationroutes.length === 2) {
              console.log(stationroutes);
            }
          });
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
};
