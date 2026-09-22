/**
 * Herramientas para Desarrolladores y Código (GitHub, GitLab, npm, PyPI, Hugging Face)
 */

async function searchGitHub(query, type = 'repositories') {
  try {
    const endpoint = type === 'users' ? 'users' : 'repositories';
    const url = `https://api.github.com/search/${endpoint}?q=${encodeURIComponent(query)}&per_page=5`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'EnlaceSocialApp/1.0', 'Accept': 'application/vnd.github.v3+json' } });
    clearTimeout(timeout);

    if (!res.ok) return { error: `GitHub API respondió con estado ${res.status}` };
    const data = await res.json();

    if (type === 'users') {
      const users = (data.items || []).map(u => ({
        username: u.login,
        avatar_url: u.avatar_url,
        profile_url: u.html_url,
        type: u.type,
      }));
      return { type: 'github_users', query, users };
    }

    const repos = (data.items || []).map(r => ({
      name: r.full_name,
      description: r.description,
      stars: r.stargazers_count,
      forks: r.forks_count,
      language: r.language,
      license: r.license?.spdx_id || r.license?.name || null,
      url: r.html_url,
    }));

    return { type: 'github_repos', query, repos };
  } catch (err) {
    return { error: `Error al consultar GitHub: ${err.message}` };
  }
}

async function searchGitLab(query) {
  try {
    const url = `https://gitlab.com/api/v4/projects?search=${encodeURIComponent(query)}&per_page=5`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return { error: `GitLab API respondió con estado ${res.status}` };
    const data = await res.json();
    const projects = (data || []).map(p => ({
      name: p.name_with_namespace,
      description: p.description,
      star_count: p.star_count,
      forks_count: p.forks_count,
      web_url: p.web_url,
    }));

    return { type: 'gitlab_projects', query, projects };
  } catch (err) {
    return { error: `Error al consultar GitLab: ${err.message}` };
  }
}

async function searchNpm(packageName) {
  try {
    const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(packageName)}&size=5`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return { error: `npm Registry respondió con estado ${res.status}` };
    const data = await res.json();
    const packages = (data.objects || []).map(o => ({
      name: o.package.name,
      version: o.package.version,
      description: o.package.description,
      publisher: o.package.publisher?.username,
      links: o.package.links,
    }));

    return { type: 'npm_packages', packageName, packages };
  } catch (err) {
    return { error: `Error al consultar npm Registry: ${err.message}` };
  }
}

async function searchPyPI(packageName) {
  try {
    const url = `https://pypi.org/pypi/${encodeURIComponent(packageName)}/json`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return { error: `No se encontró el paquete '${packageName}' en PyPI.` };
    const data = await res.json();
    const info = data.info || {};

    return {
      type: 'pypi_package',
      name: info.name,
      version: info.version,
      summary: info.summary,
      author: info.author,
      license: info.license,
      home_page: info.home_page || info.package_url,
      pypi_url: info.package_url,
    };
  } catch (err) {
    return { error: `Error al consultar PyPI: ${err.message}` };
  }
}

async function searchHuggingFace(query, type = 'models') {
  try {
    const endpoint = type === 'datasets' ? 'datasets' : 'models';
    const url = `https://huggingface.co/api/${endpoint}?search=${encodeURIComponent(query)}&limit=5`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return { error: `Hugging Face API respondió con estado ${res.status}` };
    const data = await res.json();
    const items = (data || []).map(i => ({
      id: i.id || i._id,
      author: i.author,
      downloads: i.downloads,
      likes: i.likes,
      pipeline_tag: i.pipeline_tag || null,
      url: `https://huggingface.co/${i.id}`,
    }));

    return { type: `huggingface_${type}`, query, items };
  } catch (err) {
    return { error: `Error al consultar Hugging Face: ${err.message}` };
  }
}

module.exports = { searchGitHub, searchGitLab, searchNpm, searchPyPI, searchHuggingFace };
