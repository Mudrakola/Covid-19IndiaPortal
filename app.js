const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const path = require("path");
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
    app.listen(3000, () => {
      console.log("Server Running on http://localhost:3000/");
    });
  } catch (error) {
    console.log(`Error ${error.message}`);
  }
};
initializeDbAndServer();

const authorizationToken = (request, response, next) => {
  let jwtToken;
  const authToken = request.headers["authorization"];
  if (authToken !== undefined) {
    jwtToken = authToken.split(" ")[1];
  }
  if (authToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_TOKEN_SECRET", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
        console.log("err");
      } else {
        next();
        console.log("s");
      }
    });
  }
};

app.get("/login/", authorizationToken, (request, response) => {});

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserDetails = `SELECT * FROM user WHERE username='${username}';`;
  const selectedUser = await db.get(selectUserDetails);
  if (selectedUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordCorrect = await bcrypt.compare(
      password,
      selectedUser.password
    );
    if (isPasswordCorrect === true) {
      console.log("success");
      payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_TOKEN_SECRET");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//state details API
const stateDetails = (objectDb) => {
  return {
    stateId: objectDb.state_id,
    stateName: objectDb.state_name,
    population: objectDb.population,
  };
};

//list of all states API
app.get("/states/", authorizationToken, async (request, response) => {
  const getStates = `SELECT * FROM state ORDER BY state_id;`;
  const getStateDetails = await db.all(getStates);
  response.send(getStateDetails.map((eachItem) => stateDetails(eachItem)));
});

//particular state API
app.get("/states/:stateId/", authorizationToken, async (request, response) => {
  const { stateId } = request.params;
  const getState = `SELECT * FROM state WHERE state_id='${stateId}';`;
  const getStateDetail = await db.get(getState);
  response.send(stateDetails(getStateDetail));
});

//adding District
app.post("/districts/", authorizationToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const postDistrict = `INSERT INTO district(district_name,state_id,cases,cured,active,deaths)
    VALUES('${districtName}','${stateId}','${cases}','${cured}','${active}','${deaths}');`;
  await db.run(postDistrict);
  response.send("District Successfully Added");
});

const districtDetails = (objectDb) => {
  return {
    districtId: objectDb.district_id,
    districtName: objectDb.district_name,
    stateId: objectDb.state_id,
    cases: objectDb.cases,
    cured: objectDb.cured,
    active: objectDb.active,
    deaths: objectDb.deaths,
  };
};

//particular district API
app.get(
  "/districts/:districtId/",
  authorizationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrict = `SELECT * FROM district WHERE district_id='${districtId}';`;
    const getDistrictDetail = await db.get(getDistrict);
    response.send(districtDetails(getDistrictDetail));
  }
);

//remove District API
app.delete(
  "/districts/:districtId/",
  authorizationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const removeDistrict = `DELETE FROM district WHERE district_id='${districtId}';`;
    await db.run(removeDistrict);
    response.send("District Removed");
  }
);

//updating details API
app.put(
  "/districts/:districtId/",
  authorizationToken,
  async (request, response) => {
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const { districtId } = request.params;
    const updateDistrict = `UPDATE district
  SET district_name='${districtName}',
  state_id='${stateId}',
  cases='${cases}',
  cured='${cured}',
  active='${active}',
  deaths='${deaths}'
  WHERE district_id='${districtId}';`;
    await db.run(updateDistrict);
    response.send("District Details Updated");
  }
);

//statistics API
app.get(
  "/states/:stateId/stats/",
  authorizationToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStats = `SELECT SUM(cases) AS totalCases,SUM(cured) AS totalCured,SUM(active) AS totalActive,SUM(deaths) AS totalDeaths
    FROM district
    WHERE state_id='${stateId}';`;
    const getStatistics = await db.get(getStats);
    response.send(getStatistics);
  }
);

module.exports = app;
