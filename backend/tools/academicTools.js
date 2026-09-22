/**
 * Herramientas Académicas y Científicas (arXiv, Crossref, OpenAlex, PubChem, GBIF)
 */

async function searchArxiv(query, maxResults = 5) {
  try {
    const url = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${maxResults}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return { error: `arXiv respondió con estado ${res.status}` };
    const xmlText = await res.text();

    const entries = [];
    const entryMatches = xmlText.match(/<entry>[\s\S]*?<\/entry>/g) || [];

    for (const entryXml of entryMatches) {
      const titleMatch = entryXml.match(/<title>([\s\S]*?)<\/title>/);
      const summaryMatch = entryXml.match(/<summary>([\s\S]*?)<\/summary>/);
      const idMatch = entryXml.match(/<id>([\s\S]*?)<\/id>/);
      const publishedMatch = entryXml.match(/<published>([\s\S]*?)<\/published>/);

      entries.push({
        id: idMatch ? idMatch[1].trim() : '',
        title: titleMatch ? titleMatch[1].trim().replace(/\s+/g, ' ') : '',
        summary: summaryMatch ? summaryMatch[1].trim().replace(/\s+/g, ' ').slice(0, 400) : '',
        published: publishedMatch ? publishedMatch[1].trim() : '',
      });
    }

    return { type: 'arxiv', query, count: entries.length, papers: entries };
  } catch (err) {
    return { error: `Error al consultar arXiv: ${err.message}` };
  }
}

async function searchCrossref(query, limit = 5) {
  try {
    const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=${limit}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'EnlaceSocialApp/1.0 (mailto:admin@enlace.app)' } });
    clearTimeout(timeout);

    if (!res.ok) return { error: `Crossref respondió con estado ${res.status}` };
    const data = await res.json();
    const items = (data.message?.items || []).map(item => ({
      doi: item.DOI,
      title: item.title?.[0] || 'Sin título',
      publisher: item.publisher || '',
      type: item.type || '',
      author: (item.author || []).map(a => `${a.given || ''} ${a.family || ''}`.trim()).join(', '),
      year: item.issued?.['date-parts']?.[0]?.[0] || null,
      url: item.URL,
    }));

    return { type: 'crossref', query, works: items };
  } catch (err) {
    return { error: `Error al consultar Crossref: ${err.message}` };
  }
}

async function searchOpenAlex(query, limit = 5) {
  try {
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per_page=${limit}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return { error: `OpenAlex respondió con estado ${res.status}` };
    const data = await res.json();
    const works = (data.results || []).map(w => ({
      id: w.id,
      doi: w.doi,
      title: w.title,
      publication_year: w.publication_year,
      cited_by_count: w.cited_by_count,
      authors: (w.authorships || []).slice(0, 5).map(a => a.author?.display_name).filter(Boolean),
      landing_page_url: w.landing_page_url,
    }));

    return { type: 'openalex', query, works };
  } catch (err) {
    return { error: `Error al consultar OpenAlex: ${err.message}` };
  }
}

async function searchPubChem(query) {
  try {
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(query)}/property/IUPACName,MolecularFormula,MolecularWeight,CanonicalSMILES/JSON`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return { error: `PubChem no encontró información para '${query}'.` };
    const data = await res.json();
    const compound = data.PropertyTable?.Properties?.[0];

    if (!compound) return { error: `Sin propiedades registradas en PubChem para '${query}'.` };

    return {
      type: 'pubchem',
      cid: compound.CID,
      formula: compound.MolecularFormula,
      weight: compound.MolecularWeight,
      iupac_name: compound.IUPACName,
      smiles: compound.CanonicalSMILES,
      pubchem_url: `https://pubchem.ncbi.nlm.nih.gov/compound/${compound.CID}`,
    };
  } catch (err) {
    return { error: `Error al consultar PubChem: ${err.message}` };
  }
}

async function searchGBIF(query, limit = 5) {
  try {
    const url = `https://api.gbif.org/v1/species/search?q=${encodeURIComponent(query)}&limit=${limit}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return { error: `GBIF respondió con estado ${res.status}` };
    const data = await res.json();
    const species = (data.results || []).map(s => ({
      key: s.key,
      scientificName: s.scientificName,
      canonicalName: s.canonicalName,
      rank: s.rank,
      kingdom: s.kingdom,
      phylum: s.phylum,
      family: s.family,
      genus: s.genus,
    }));

    return { type: 'gbif', query, species };
  } catch (err) {
    return { error: `Error al consultar GBIF: ${err.message}` };
  }
}

module.exports = { searchArxiv, searchCrossref, searchOpenAlex, searchPubChem, searchGBIF };
