
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  const API_KEY = process.env.API_KEY;
  const API_URL = 'https://api.football-data.org/v2/competitions/BSA/standings';

  try {
    const response = await fetch(API_URL, {
      headers: { 'X-Auth-Token': API_KEY }
    });
    const data = await response.json();
    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch data' })
    };
  }
};
