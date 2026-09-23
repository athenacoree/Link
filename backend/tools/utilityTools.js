/**
 * Herramientas de Utilidad, Conversión, Comida y Entretenimiento Diario
 */

async function getNagerHolidays(year, countryCode = 'CU') {
  try {
    const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/${encodeURIComponent(countryCode)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return { error: `Nager.Date respondió con estado ${res.status}` };
    const data = await res.json();
    const holidays = (data || []).map(h => ({
      date: h.date,
      localName: h.localName,
      name: h.name,
      countryCode: h.countryCode,
      global: h.global,
    }));

    return { type: 'nager_holidays', year, countryCode, holidays };
  } catch (err) {
    return { error: `Error al consultar feriados en Nager.Date: ${err.message}` };
  }
}

async function convertCurrencyFrankfurter(amount = 1, from = 'USD', to = 'EUR') {
  try {
    const url = `https://api.frankfurter.app/latest?amount=${amount}&from=${encodeURIComponent(from.toUpperCase())}&to=${encodeURIComponent(to.toUpperCase())}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return { error: `Frankfurter API respondió con estado ${res.status}` };
    const data = await res.json();

    return {
      type: 'frankfurter_currency',
      amount,
      from: data.base,
      date: data.date,
      rates: data.rates,
    };
  } catch (err) {
    return { error: `Error al convertir divisa en Frankfurter: ${err.message}` };
  }
}

async function searchTheMealDB(recipeQuery) {
  try {
    const url = `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(recipeQuery)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return { error: `TheMealDB respondió con estado ${res.status}` };
    const data = await res.json();
    const meals = (data.meals || []).slice(0, 3).map(m => ({
      id: m.idMeal,
      name: m.strMeal,
      category: m.strCategory,
      area: m.strArea,
      instructions: m.strInstructions ? m.strInstructions.slice(0, 400) + '...' : '',
      thumbnail: m.strMealThumb,
      youtube: m.strYoutube,
    }));

    return { type: 'themealdb_recipes', query: recipeQuery, meals };
  } catch (err) {
    return { error: `Error al consultar TheMealDB: ${err.message}` };
  }
}

async function searchOpenFoodFacts(barcode) {
  try {
    const url = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return { error: `Open Food Facts respondió con estado ${res.status}` };
    const data = await res.json();

    if (data.status !== 1) {
      return { error: `Producto con código de barras '${barcode}' no encontrado en Open Food Facts.` };
    }

    const p = data.product;
    return {
      type: 'openfoodfacts_product',
      code: p.code,
      product_name: p.product_name || p.product_name_es || 'Sin nombre',
      brands: p.brands,
      categories: p.categories,
      nutriscore_grade: p.nutriscore_grade?.toUpperCase(),
      image_url: p.image_url || p.image_front_url,
      ingredients_text: p.ingredients_text_es || p.ingredients_text,
    };
  } catch (err) {
    return { error: `Error al consultar Open Food Facts: ${err.message}` };
  }
}

async function getRandomJoke() {
  try {
    const url = 'https://v2.jokeapi.dev/joke/Any?safe-mode';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return { error: `JokeAPI respondió con estado ${res.status}` };
    const data = await res.json();

    return {
      type: 'jokeapi',
      category: data.category,
      joke_type: data.type,
      joke: data.type === 'single' ? data.joke : `${data.setup} ... ${data.delivery}`,
    };
  } catch (err) {
    return { error: `Error al obtener chiste: ${err.message}` };
  }
}

async function getRandomDogImage() {
  try {
    const url = 'https://dog.ceo/api/breeds/image/random';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return { error: `Dog CEO API respondió con estado ${res.status}` };
    const data = await res.json();

    return { type: 'dog_ceo', image_url: data.message };
  } catch (err) {
    return { error: `Error al obtener foto de perro: ${err.message}` };
  }
}

async function getCatFact() {
  try {
    const url = 'https://catfact.ninja/fact';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return { error: `Cat Facts API respondió con estado ${res.status}` };
    const data = await res.json();

    return { type: 'cat_fact', fact: data.fact };
  } catch (err) {
    return { error: `Error al obtener dato curioso de gato: ${err.message}` };
  }
}

async function getNumbersApiFact(number = 'random', type = 'trivia') {
  try {
    const url = `http://numbersapi.com/${encodeURIComponent(number)}/${encodeURIComponent(type)}?json`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return { error: `Numbers API respondió con estado ${res.status}` };
    const data = await res.json();

    return { type: 'numbers_api', number: data.number, text: data.text, fact_type: data.type };
  } catch (err) {
    return { error: `Error al consultar Numbers API: ${err.message}` };
  }
}

const AdmZip = require('adm-zip');

async function createZipArchive(filename = 'archivo_enlace.zip', files = []) {
  try {
    const zip = new AdmZip();
    if (Array.isArray(files) && files.length > 0) {
      files.forEach(f => {
        const fname = f.name || 'archivo.txt';
        const fcontent = typeof f.content === 'string' ? f.content : JSON.stringify(f.content || '');
        zip.addFile(fname, Buffer.from(fcontent, 'utf8'));
      });
    } else {
      zip.addFile('nota.txt', Buffer.from('Archivo generado por Link AI en la red social Link.', 'utf8'));
    }

    const zipBase64 = zip.toBuffer().toString('base64');
    return {
      type: 'zip_download',
      filename: filename.endsWith('.zip') ? filename : `${filename}.zip`,
      download_url: `/api/ai/download-zip?filename=${encodeURIComponent(filename)}`,
      zip_data_base64: zipBase64,
      file_count: files.length || 1,
    };
  } catch (err) {
    return { error: `Error al crear archivo ZIP: ${err.message}` };
  }
}

module.exports = {
  getNagerHolidays,
  convertCurrencyFrankfurter,
  searchTheMealDB,
  searchOpenFoodFacts,
  getRandomJoke,
  getRandomDogImage,
  getCatFact,
  getNumbersApiFact,
  createZipArchive,
};
