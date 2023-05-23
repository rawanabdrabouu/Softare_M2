const { isEmpty, update } = require("lodash");
const { v4 } = require("uuid");
const db = require("../../connectors/db");
const roles = require("../../constants/roles");
const { getSessionToken } = require('../../utils/session')

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
    .innerJoin(
      "users",
      "sessions.userid",
      "users.id"
    )
    .innerJoin(
      "roles",
      "users.roleid",
      "roles.id"
    )
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
      const users = await db.select('*').from("users")

      return res.status(200).json(users);
    } catch (e) {
      console.log(e.message);
      return res.status(400).send("Could not get users");
    }
  });


  app.put('/api/v1/password/reset', async function (req, res) {
    const user = await getUser(req);

    const newPassword = req.body.newPassword;

    if (!newPassword) {
      return res.status(400).send("new passwoes is required")
    }

     db.from("users").where('email', user.email).update({password: newPassword});

    return res.status(200).send("Password has been updsatd");
  });
};
