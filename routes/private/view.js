const db = require('../../connectors/db');
const roles = require('../../constants/roles');
const { getSessionToken } = require('../../utils/session');

const getUser = async function(req) {
  const sessionToken = getSessionToken(req);
  if (!sessionToken) {
    return res.status(301).redirect('/');
  }

  const user = await db.select('*')
    .from('sessions')
    .where('token', sessionToken)
    .innerJoin('users', 'sessions.userid', 'users.id')
    .innerJoin('roles', 'users.roleid', 'roles.id')
    .first();
  
    user.isNormal = user.roleid === roles.user;
    user.isAdmin = user.roleid === roles.admin;
    user.isSenior = user.roleid === roles.senior;

  return user;  
}

module.exports = function(app) {
  // Register HTTP endpoint to render /users page
  app.get('/dashboard', async function(req, res) {
    const user = await getUser(req);
    return res.render('dashboard', {...user});
  });

  app.get('/resetPassword', async function(req, res) {
    const user = await getUser(req);
    console.log(user)
    return res.render('resetPassword', user);
  });

  // Register HTTP endpoint to render /users page
  app.get('/users', async function(req, res) {
    const users = await db.select('*').from('users');
    return res.render('users', { users });
  });

  // Register HTTP endpoint to render /courses page
  app.get('/stations', async function(req, res) {
    const user = await getUser(req);
    const stations = await db.select('*').from('stations');
    return res.render('stations_example', { ...user, stations });
  });

  app.get('/requests/senior', async function(req, res) {
    const user = await getUser(req);
    return res.render('requests/senior', user);
  });

  app.get('/requests/refund', async function(req, res) {
    const user = await getUser(req);
    const reqs = await db.from('tickets').select('*').where('userid', user.userid);
    return res.render('requests/refund', {reqs});
  });

  app.get('/manage/requests/seniors', async function(req, res) {
    const reqs = await db.from('senior_requests').select('*').where('status', 'pending');
    return res.render('manage/requests/seniors', {reqs});
  });

  app.get('/manage/requests/refunds', async function(req, res) {
    const reqs = await db.from('refund_requests').select('*').where('status', 'pending');
    return res.render('manage/requests/refunds', {reqs});
  });

};