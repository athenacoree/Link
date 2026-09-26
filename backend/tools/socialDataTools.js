/**
 * Herramientas de Redes Sociales, Crypto e Indicadores Económicos (YouTube, Twitch, Reddit, Mastodon, Hacker News, World Bank, CoinGecko)
 */

async function searchReddit(subreddit = 'all', query = '', limit = 5) {
  try {
    const cleanSub = subreddit.replace(/^r\//, '');
    const url = query
      ? `https://www.reddit.com/r/${cleanSub}/search.json?q=${encodeURIComponent(query)}&limit=${limit}&restrict_sr=1`
      : `https://www.reddit.com/r/${cleanSub}/hot.json?limit=${limit}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'EnlaceSocialApp/1.0' } });
    clearTimeout(timeout);

    if (!res.ok) return { error: `Reddit API respondió con estado ${res.status}` };
    const data = await res.json();
    const posts = (data.data?.children || []).map(child => ({
      id: child.data.id,
      title: child.data.title,
      author: child.data.author,
      subreddit: child.data.subreddit,
      score: child.data.score,
      num_comments: child.data.num_comments,
      url: `https://reddit.com${child.data.permalink}`,
      thumbnail: child.data.thumbnail?.startsWith('http') ? child.data.thumbnail : null,
      selftext: child.data.selftext ? child.data.selftext.slice(0, 300) : '',
    }));

    return { type: 'reddit_posts', subreddit: cleanSub, query, posts };
  } catch (err) {
    return { error: `Error al consultar Reddit: ${err.message}` };
  }
}

async function getHackerNewsTop(limit = 5) {
  try {
    const url = 'https://hacker-news.firebaseio.com/v0/topstories.json';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return { error: `Hacker News respondió con estado ${res.status}` };
    const storyIds = await res.json();
    const topIds = (storyIds || []).slice(0, limit);

    const stories = await Promise.all(topIds.map(async id => {
      try {
        const itemRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
        if (itemRes.ok) return await itemRes.json();
      } catch (e) {}
      return null;
    }));

    const validStories = stories.filter(Boolean).map(s => ({
      id: s.id,
      title: s.title,
      by: s.by,
      score: s.score,
      comments: s.descendants || 0,
      time: new Date(s.time * 1000).toISOString(),
      url: s.url || `https://news.ycombinator.com/item?id=${s.id}`,
    }));

    return { type: 'hacker_news', count: validStories.length, stories: validStories };
  } catch (err) {
    return { error: `Error al consultar Hacker News: ${err.message}` };
  }
}

async function getCoinGeckoPrices(ids = 'bitcoin,ethereum,cardano,solana', vsCurrencies = 'usd,eur') {
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=${encodeURIComponent(vsCurrencies)}&include_24hr_change=true`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return { error: `CoinGecko respondió con estado ${res.status}` };
    const data = await res.json();

    return { type: 'coingecko_prices', prices: data };
  } catch (err) {
    return { error: `Error al consultar precios en CoinGecko: ${err.message}` };
  }
}

async function getWorldBankIndicator(countryCode = 'CUB', indicator = 'NY.GDP.MKTP.CD') {
  try {
    const url = `https://api.worldbank.org/v2/country/${encodeURIComponent(countryCode)}/indicator/${encodeURIComponent(indicator)}?format=json&per_page=5`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return { error: `Banco Mundial respondió con estado ${res.status}` };
    const data = await res.json();
    const records = (data[1] || []).map(r => ({
      country: r.country?.value,
      country_code: r.countryiso3code,
      indicator: r.indicator?.value,
      indicator_id: r.indicator?.id,
      date: r.date,
      value: r.value,
    }));

    return { type: 'world_bank', countryCode, indicator, records };
  } catch (err) {
    return { error: `Error al consultar el Banco Mundial: ${err.message}` };
  }
}

async function searchMastodonPosts(query = 'technology', limit = 5) {
  const cleanQ = (query || 'technology').trim();
  try {
    const url = `https://mastodon.social/api/v2/search?q=${encodeURIComponent(cleanQ)}&limit=${limit}&type=statuses`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return { error: `Mastodon API respondió con estado ${res.status}` };
    const data = await res.json();
    const statuses = (data.statuses || []).map(s => ({
      id: s.id,
      account: s.account?.username,
      account_display: s.account?.display_name,
      content: s.content ? s.content.replace(/<[^>]+>/g, '').slice(0, 300) : '',
      created_at: s.created_at,
      url: s.url,
      reblogs_count: s.reblogs_count,
      favourites_count: s.favourites_count,
    }));

    return { type: 'mastodon_posts', query, statuses };
  } catch (err) {
    return { error: `Error al consultar Mastodon: ${err.message}` };
  }
}

module.exports = { searchReddit, getHackerNewsTop, getCoinGeckoPrices, getWorldBankIndicator, searchMastodonPosts };
