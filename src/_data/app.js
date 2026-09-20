const fs = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");
const vegetation = require("./vegetation");

function loadYaml(filename) {
  const filepath = path.join(__dirname, filename);
  return yaml.load(fs.readFileSync(filepath, "utf8"));
}

module.exports = {
  map: loadYaml("map.yaml").map,
  places: loadYaml("places.yaml"),
  vegetation,
};
