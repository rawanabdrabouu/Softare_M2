const db = require('../../connectors/db');
const roles = require('../../constants/roles');
const { getSessionToken } = require('../../utils/session');

const getUser = async function (req) {
  const sessionToken = getSessionToken(req);
  if (!sessionToken) {
    return res.status(301).redirect('/');
  }

  console.log(sessionToken);
  const user = await db.select('*')
    .from('sessions')
    .where('token', sessionToken)
    .innerJoin('users', 'sessions.userid', 'users.id')
    .innerJoin('roles', 'users.roleid', 'roles.id')
    .first();
console.log(user);
  user.isStudent = user.roleid === roles.student;
  user.isAdmin = user.roleid === roles.admin;
  user.isSenior = user.roleid === roles.senior;

  return user;
}

module.exports = function (app) {
  // Register HTTP endpoint to render /users page
  app.get('/dashboard', async function (req, res) {
    const user = await getUser(req);
    return res.render('dashboard', user);
  });

  // Register HTTP endpoint to render /users page
  app.get('/users', async function (req, res) {
    const users = await db.select('*').from('users');
    return res.render('users', { users });
  });

  // Register HTTP endpoint to render /courses page
  app.get('/stations', async function (req, res) {
    const user = await getUser(req);
    const stations = await db.select('*').from('stations');
    return res.render('stations_example', { ...user, stations });
  });
  
  app.get('/manage/routes', async function (req, res) {
    const routes = await db.from("routes").select("*");
    console.log(routes);
    return res.render('manage/routes/index.hjs', {routes});
  })

  app.get('/subscriptions/purchase', async function(req, res) {
    const user = await getUser(req);
    const zones = await db.from('zones').select('*');
    // const subs= await db.from(subsription).select("*").where("userid","=",user.userid);
    return res.render('subscriptions/purchase.hjs', {user , zones});
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


  app.get('/manage/stations/create', async function(req, res) {
    return res.render('manage/stations/create.hjs')

  });

  app.get('/manage/zones', async function(req, res) {
    const reqs =await db.from('zones').select('*');
    return res.render('manage/zones.hjs',{reqs});

  });

  app.get('/manage/stations', async function(req, res) {
    const reqs =await db.from('stations').select('*');
    return res.render('manage/stations/index.hjs',{reqs});

  });

  app.get('/manage/stations/edit/:stationId', async function(req, res) {
    const stationId = req.params.stationId;

    const station =await db.from('stations').where('id',stationId).first();
    return res.render('manage/stations/edit.hjs',{station});

  });


   app.get('/manage/routes/create', async function (req, res) {
    return res.render('manage/routes/create.hjs',{});
  })

  app.get('/manage/routes/edit/:routeId', async function (req, res) {
    const routeId = req.params.routeId

    const route = await db.from("routes").select("*").where('id',routeId).first();
    if (!route) {
      return res.redirect('manage/routes')
    }
    return res.render('manage/routes/update.hjs',{route});
  })

  app.get('/tickets/purchase', async function(req, res) {
    const user = await getUser(req);
    return res.render('tickets/purchase.hjs', {user});
  });


};