/**
 * Servicio Backend para Link Video
 */

const videoStreamTool = require('../tools/videoStreamTool');

async function getCatalog(forceRefresh = false) {
  return await videoStreamTool.getVideoCatalog(forceRefresh);
}

async function getStreamById(streamId) {
  const catalog = await getCatalog();
  return catalog.find(s => s.id === streamId) || null;
}

module.exports = {
  getCatalog,
  getStreamById,
  getLinkVideoBaseUrl: videoStreamTool.getLinkVideoBaseUrl
};
