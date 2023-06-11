const { isEmpty } = require("lodash");
const { v4 } = require("uuid");
const db = require("../../connectors/db");
const roles = require("../../constants/roles");
module.exports = function (app) {
  app.post("/api/v1/user", async function (req, res) {
    // Check if user already exists in the system
    const userExists = await db
      .select("*")
      .from("users")
      .where("email", req.body.email);
    if (!isEmpty(userExists)) {
      return res.status(400).send("user exists");
    }

    const newUser = {
      firstname: req.body.firstname,
      lastname: req.body.lastname,
      email: req.body.email,
      password: req.body.password,
      roleid: roles.user,
    };
    try {
      const user = await db("users").insert(newUser).returning("*");

      return res.status(200).json(user);
    } catch (e) {
      return res.status(400).send("Could not register user");
    }
  });

  // Register HTTP endpoint to create new user
  app.post("/api/v1/user/login", async function (req, res) {
    // get users credentials from the JSON body
    const { email, password } = req.body;
    if (!email) {
      // If the email is not present, return an HTTP unauthorized code
      return res.status(400).send("email is required");
    }
    if (!password) {
      // If the password is not present, return an HTTP unauthorized code
      return res.status(400).send("Password is required");
    }

    // validate the provided password against the password in the database
    // if invalid, send an unauthorized code
    const user = await db
      .select("*")
      .from("users")
      .where("email", email)
      .first();
    if (isEmpty(user)) {
      return res.status(400).send("user does not exist");
    }
    if (user.password !== password) {
      return res.status(401).send("Password does not match");
    }

    // set the expiry time as 15 minutes after the current time
    const token = v4();
    const currentDateTime = new Date();
    const expiresat = new Date(+currentDateTime + 900000); // expire in 15 minutes

    // create a session containing information about the user and expiry time
    const session = {
      userid: user.id,
      token,
      expiresat,
    };
    try {
      await db("sessions").insert(session);
      // In the response, set a cookie on the client with the name "session_cookie"
      // and the value as the UUID we generated. We also set the expiration time.
      return res
        .cookie("session_token", token, { expires: expiresat })
        .status(200)
        .send("login successful");
    } catch (e) {
      return res.status(400).send("Could not register user");
    }
  });

    app.get("/api/v1/zone", async function (req, res) {
      const data = await db.select("*").from("zones");
      return res.status(200).json(data);
  });
  app.post(
    "/api/v1/tickets/price/:originId/:destinationId",
    async function (req, res) {
      const originId = req.params.originId;
      const destinationId = req.params.destinationId;
      const routes = await db
        .from("routes")
        .select("fromstationid", "tostationid");
      let result = getRouteStation(routes, originId, destinationId);
      if (result.length < 9) {
        //2
        const price = await db
          .from("zones")
          .select("price")
          .where("id", 1)
          .first()
          .then(function (price) {
            if (!price) {
              return res.status(400).send("error: pls enter price");
            } else {
              return res.status(200).json(price.price);
            }
          });
      } else if (result.length >= 9) {
        //3
        const price = await db
          .from("zones")
          .select("price")
          .where("id", 2)
          .first()
          .then(function (price) {
            if (!price) {
              return res.status(400).send("error: pls enter price");
            } else {
              return res.status(200).json(price.price);
            }
          });
      } else if (result.length > 16) {
        
        //4
        const price = await db
        .from("zones")
        .select("price")
        .where("id", 3)
        .first()
        .then(function (price) {
            if (!price) {
              return res.status(400).send("error: pls enter price");
            } else {console.log(price);
              return res.status(200).json(price.price);
            }
          });console.log(price);
          return res.status(200).send("No route");
        } 
        console.log(result.length);
    });
  
  
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
        if (shortestRoute.length === 0 || shortestRoute.length > inroute.length) {
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

