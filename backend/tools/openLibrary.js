/**
 * Herramienta Open Library
 */
async function searchBooks(query, limit = 5) {
  try {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=${limit}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return { error: `Open Library respondió con estado ${res.status}` };
    const data = await res.json();
    const docs = (data.docs || []).slice(0, limit).map(doc => ({
      title: doc.title,
      author: (doc.author_name || []).join(', '),
      first_publish_year: doc.first_publish_year || null,
      isbn: (doc.isbn || [])[0] || null,
      cover_url: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
      key: doc.key,
    }));

    return { type: 'open_library', query, total: data.numFound || docs.length, books: docs };
  } catch (err) {
    return { error: `Error al consultar Open Library: ${err.message}` };
  }
}

async function getBookDetails(openLibraryKey) {
  try {
    if (!openLibraryKey || typeof openLibraryKey !== 'string') {
      return { error: 'Se requiere una clave de obra válida de Open Library (ej: OL45804W o /works/OL45804W).' };
    }
    const cleanKey = openLibraryKey.startsWith('/') ? openLibraryKey : `/works/${openLibraryKey}`;
    const url = `https://openlibrary.org${cleanKey}.json`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return { error: `Open Library no encontró la obra (${res.status})` };
    const data = await res.json();
    const description = typeof data.description === 'string' ? data.description : (data.description?.value || 'Sin descripción.');

    return {
      type: 'open_library_details',
      title: data.title,
      description,
      subjects: (data.subjects || []).slice(0, 10),
      created: data.created?.value || null,
    };
  } catch (err) {
    return { error: `Error obteniendo detalles del libro: ${err.message}` };
  }
}

module.exports = { searchBooks, getBookDetails };
