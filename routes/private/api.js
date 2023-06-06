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

    const requestId = req.params.requestId.substring(1);
    if (req.body.status == "accepted" || req.body.status == "accept") {
      db.from("senior_requests")
        .where("id", requestId)
        .update({ status: "accepted" })
        .then((status) => {
          const newSeniorId = db
            .from("senior_requests")
            .where("id", requestId)
            .select("userid");
          db.from("users")
            .where("id", newSeniorId)
            .update({ roleid: 3 })
            .then((roleid) => {
              res.status(200).send("roleid is updated");
            })
            .catch((err) => {
              res
                .status(500)
                .send("error updating user's role id with id = " + user.id);
            });
          res.status(200).send("status is updated");
        })
        .catch((err) => {
          res.status(500).send("error updating request with id = " + user.id);
        });
    } else if (req.body.status == "rejected" || req.body.status == "reject") {
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
    // console.log(req);
    const stationID = req.params.stationID;
    const station = await db.from("stations").where("id", stationID).first();

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

  app.post("/api/v1/tickets/price/:originId/:destinationId",
    async function (req, res) {
      const originId = req.params.originId;
      const destinationId = req.params.destinationId;
      const routes = await db
        .from("routes")
        .select("fromstationid", "tostationid");

      let retult = getRouteStation(routes, originId, destinationId);

      return res.status(200).json(retult);
      function getRouteStation(routes, from, to) {
        let originId = parseInt(from);
        let destinationId = parseInt(to);

        let visited = new Set();
        visited.add(originId);
        let shortestRoute = [];
        DFS(originId, destinationId, [], visited);
        return shortestRoute;
      }
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
          console.log(shortestRoute)

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
  );
};
