const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();
app.use(express.json());

let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3003, () => {
      console.log("Server Running at http://localhost:3003/");
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
  }
};

initializeDbAndServer();

const ans = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

const authenticationToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "My_Secret_Token", async (error, playload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
        SELECT 
          *
        FROM 
          user
        WHERE 
          username = '${username}';`;

  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const playload = { username: username };
      const jwtToken = jwt.sign(playload, "My_Secret_Token");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get("/states/", authenticationToken, async (request, response) => {
  const selectALlStatesQuery = `
        SELECT 
          *
        FROM 
          state;`;

  const statesArray = await db.all(selectALlStatesQuery);
  response.send(statesArray.map((eachState) => ans(eachState)));
});

app.get("/states/:stateId/", authenticationToken, async (request, response) => {
  const { stateId } = request.params;
  const selectStateQuery = `
        SELECT
          *
        FROM 
          state
        WHERE 
          state_id = ${stateId};`;

  const state = await db.get(selectStateQuery);
  response.send(ans(state));
});

app.post("/districts/", authenticationToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const postDistrictQuery = `
        INSERT INTO
          district (district_name, state_id, cases, cured, active, deaths)
        VALUES
           ('${districtName}', '${stateId}', '${cases}', '${cured}', '${active}', '${deaths}');`;

  await db.run(postDistrictQuery);
  response.send("District Successfully Added");
});

app.get(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
        SELECT 
          *
        FROM
          district
        WHERE 
          district_id = ${districtId};`;

    const district = await db.get(getDistrictQuery);
    response.send(ans(district));
  }
);

app.delete(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
        DELETE FROM
          district
        WHERE
          district_id = '${districtId}';`;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

app.put(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `
        UPDATE 
          district
        SET
          district_name = '${districtName}',
          state_id = '${stateId}',
          cases = '${cases}',
          cured = '${cured}',
          active = '${active}',
          deaths = '${deaths}'
        WHERE
          district_id = ${districtId};`;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateStatsQuery = `
        SELECT
          SUM(cases),
          SUM(cured),
          SUM(active), 
          SUM(deaths)
        FROM
          district
        WHERE
          state_id = ${stateId};`;

    const stats = await db.get(getStateStatsQuery);
    response.send({
      totalCases: stats["SUM(cases)"],
      totalCured: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);

module.exports = app;
