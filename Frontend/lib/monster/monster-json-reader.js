import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_MONSTERS_FILE_PATH = path.join(process.cwd(), "public", "dataset", "monsters.json");
const DEFAULT_TEMPLATE_FILE_PATH = path.join(process.cwd(), "public", "dataset", "template.json");

let datasetCache = {
  monsters: [],
  signature: null,
  templates: []
};
let pendingDatasetLoad = null;

async function readFileStat(filePath) {
  try {
    return await fs.stat(filePath);
  } catch {
    return null;
  }
}

function buildDatasetSignature(monsterStats, templateStats) {
  return [
    monsterStats ? `${monsterStats.mtimeMs}:${monsterStats.size}` : "monsters:missing",
    templateStats ? `${templateStats.mtimeMs}:${templateStats.size}` : "template:missing"
  ].join("|");
}

function parseArrayJson(content) {
  const parsed = JSON.parse(content);
  return Array.isArray(parsed) ? parsed : [];
}

function createDatasetPayload(monsters, templates, signature) {
  return {
    monsters,
    signature,
    templates
  };
}

export async function readMonsterJsonDataset({
  monstersFilePath = DEFAULT_MONSTERS_FILE_PATH,
  templatesFilePath = DEFAULT_TEMPLATE_FILE_PATH
} = {}) {
  const monsterStats = await readFileStat(monstersFilePath);
  const templateStats = await readFileStat(templatesFilePath);
  const signature = buildDatasetSignature(monsterStats, templateStats);

  if (datasetCache.signature === signature) {
    return createDatasetPayload(datasetCache.monsters, datasetCache.templates, signature);
  }

  if (pendingDatasetLoad?.signature === signature) {
    return pendingDatasetLoad.promise;
  }

  const promise = Promise.all([
      fs.readFile(monstersFilePath, "utf8"),
      fs.readFile(templatesFilePath, "utf8").catch(() => "[]")
    ])
    .then(([monsterContent, templateContent]) => {
      const monsters = parseArrayJson(monsterContent);
      const templates = parseArrayJson(templateContent);

      datasetCache = createDatasetPayload(monsters, templates, signature);
      return createDatasetPayload(monsters, templates, signature);
    })
    .catch(() => createDatasetPayload(datasetCache.monsters, datasetCache.templates, datasetCache.signature))
    .finally(() => {
      if (pendingDatasetLoad?.signature === signature) {
        pendingDatasetLoad = null;
      }
    });

  pendingDatasetLoad = {
    promise,
    signature
  };

  return promise;
}
