/**
 * Herramienta Internet Archive y Wayback Machine
 */
async function searchArchive(query, limit = 5) {
  try {
    const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}&fl[]=identifier,title,description,mediatype,publicdate&rows=${limit}&output=json`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return { error: `Internet Archive respondió con estado ${res.status}` };
    const data = await res.json();
    const docs = (data.response?.docs || []).map(d => ({
      identifier: d.identifier,
      title: d.title,
      description: d.description ? String(d.description).slice(0, 300) : '',
      media_type: d.mediatype,
      public_date: d.publicdate,
      url: `https://archive.org/details/${d.identifier}`,
    }));

    return { type: 'internet_archive', query, items: docs };
  } catch (err) {
    return { error: `Error al consultar Internet Archive: ${err.message}` };
  }
}

async function checkWayback(targetUrl, timestamp = '') {
  try {
    const url = `https://archive.org/wayback/available?url=${encodeURIComponent(targetUrl)}${timestamp ? '&timestamp=' + timestamp : ''}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return { error: `Wayback Machine respondió con estado ${res.status}` };
    const data = await res.json();
    const snapshot = data.archived_snapshots?.closest;

    if (!snapshot || !snapshot.available) {
      return { available: false, url: targetUrl, message: 'No hay capturas disponibles en Wayback Machine.' };
    }

    return {
      type: 'wayback_snapshot',
      available: true,
      original_url: targetUrl,
      snapshot_url: snapshot.url,
      timestamp: snapshot.timestamp,
      status: snapshot.status,
    };
  } catch (err) {
    return { error: `Error al consultar Wayback Machine: ${err.message}` };
  }
}

module.exports = { searchArchive, checkWayback };
