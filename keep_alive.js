const express = require("express");
const server = express();

server.all("/", (req, res) => {
  res.send("Snowy Solutions bot is alive!");
});

function keepAlive() {
  server.listen(3000, () => {
    console.log("Keep-alive server running on port 3000");
  });
}

module.exports = keepAlive;
