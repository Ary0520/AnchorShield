const axios = require('axios');

async function getToml(domain) {
  try {
    const res = await axios.get(`https://${domain}/.well-known/stellar.toml`);
    console.log(`\n--- ${domain} ---`);
    const accounts = res.data.match(/ACCOUNTS\s*=\s*\[(.*?)\]/s);
    if (accounts) console.log("ACCOUNTS:", accounts[1].trim());
    
    const sep24 = res.data.match(/TRANSFER_SERVER_SEP0024\s*=\s*['"]([^'"]+)['"]/i);
    if (sep24) console.log("SEP24:", sep24[1]);
  } catch (e) {
    console.error(domain, e.message);
  }
}

getToml('circle.com');
getToml('stellar.moneygram.com');
