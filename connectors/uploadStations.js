const db = require("./db");
async function uploadSR() {

  let SR = [
    { stationid: 1, routeid: 1 },
    { stationid: 1, routeid: 2 },
    { stationid: 2, routeid: 2 },
    { stationid: 2, routeid: 3 },
    { stationid: 3, routeid: 3 },
    { stationid: 3, routeid: 4 },
    { stationid: 3, routeid: 5 },
    { stationid: 3, routeid: 6 },
    { stationid: 3, routeid: 7 },
    { stationid: 3, routeid: 8},
    { stationid: 4, routeid: 5 },
    { stationid: 4, routeid: 6 },
    { stationid: 4, routeid: 9},
    { stationid: 4, routeid: 10 },
    { stationid: 5, routeid: 9 },
    { stationid: 5, routeid: 10 },
    { stationid: 6, routeid: 7 },
    { stationid: 6, routeid: 8 },
    { stationid: 6, routeid: 11 },
    { stationid: 6, routeid: 12 },
  ];
  for (let i = 0; i < SR.length; i++) {
    const element =SR[i];
    await db("stationroutes").insert(element).returning("*");
  }

}
async function uploadS() {
  let stations = [
    {
      stationname: "s1",
      stationtype: "normal",
      stationposition: "start",
      stationstatus: "old",
    },
    {
      stationname: "s2",
      stationtype: "normal",
      stationposition: "middle",
      stationstatus: "old",
    },
    {
      stationname: "s3",
      stationtype: "transfer",
      stationposition: "middle",
      stationstatus: "old",
    },
    {
      stationname: "s4",
      stationtype: "normal",
      stationposition: "middle",
      stationstatus: "old",
    },
    {
      stationname: "s5",
      stationtype: "normal",
      stationposition: "end",
      stationstatus: "old",
    },
    {
      stationname: "s6",
      stationtype: "normal",
      stationposition: "middle",
      stationstatus: "old",
    },
    {
      stationname: "s7",
      stationtype: "normal",
      stationposition: "end",
      stationstatus: "old",
    },
  ];

  for (let i = 0; i < stations.length; i++) {
    const element =stations[i];
    await db("stations").insert(element).returning("*");
  }
}
async function uploadR() {
    let routes = [
      { routename: "hi12", fromstationid: 1, tostationid: 2 },
      { routename: "hi21", fromstationid: 2, tostationid: 1 },
      { routename: "hi23", fromstationid: 2, tostationid: 3 },
      { routename: "hi32", fromstationid: 3, tostationid: 2 },
      { routename: "hi34", fromstationid: 3, tostationid: 4 },
      { routename: "hi43", fromstationid: 4, tostationid: 3 },
      { routename: "hi36", fromstationid: 3, tostationid: 6 },
      { routename: "hi63", fromstationid: 6, tostationid: 3 },
      { routename: "hi45", fromstationid: 4, tostationid: 5 },
      { routename: "hi54", fromstationid: 5, tostationid: 4 },
      { routename: "hi76", fromstationid: 7, tostationid: 6 },
      { routename: "hi67", fromstationid: 6, tostationid: 7 },
    ];
    
  for (let i = 0; i < routes.length; i++) {
    const element =routes[i];
    await db("routes").insert(element).returning("*");
  }
}

async function uploadZ(){
  let zones = [
    { zonetype: "z1", price:5},
    {zonetype: "z2", price:7},
    {zonetype:"z3", price:10}
  ]
  for( let i=0; i< zones.length;i++){
    const element = zones[i]
    await db("zones").insert(element).returning("*");
  }
}
 //uploadS(); //first to run
 //uploadR(); //second\uploadStations.js
//uploadSR(); //third
//uploadZ();
// async function uploadsubtype() {
//   let  subscriptontype   =[ { subtype: "annual", nooftickets: 100, price: 150 },
//      { subtype: "quarterly", nooftickets: 50, price: 100 },
//      { subtype: "monthly", nooftickets: 10, price: 50 }
//    ];
//    for (let i = 0; i < subscriptontype.length; i++) {
//      const element = subscriptontype[i];
//      await db("subscriptontype").insert(element).returning("*");
//    }
//  }

//uploadsubtype();
