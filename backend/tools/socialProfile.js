/**
 * Herramienta: social.profile()
 * Consulta segura de información pública/autorizada de perfiles
 */
const { query } = require('../db/postgres');

async function getProfile(queryOrUsername, requesterId = null) {
  const cleanTerm = (queryOrUsername || '').replace(/^@/, '').trim();
  if (!cleanTerm) return { error: 'Nombre de usuario o término de búsqueda no proporcionado.' };

  try {
    const { rows } = await query(
      `SELECT id, name, username, avatar_data, profession, city, bio, verified, social_links, created_at
       FROM users
       WHERE LOWER(username) = LOWER($1)
          OR LOWER(name) ILIKE $2
          OR LOWER(username) ILIKE $2
       ORDER BY (CASE WHEN LOWER(username) = LOWER($1) THEN 1 ELSE 2 END), created_at DESC
       LIMIT 1`,
      [cleanTerm, `%${cleanTerm}%`]
    );

    if (rows.length > 0) {
      const u = rows[0];
      let links = {};
      try {
        links = typeof u.social_links === 'string' ? JSON.parse(u.social_links) : (u.social_links || {});
      } catch (e) {}

      let ints = [];
      try { ints = typeof u.interests === 'string' ? JSON.parse(u.interests) : (u.interests || []); } catch (e) {}

      return {
        type: 'social_profile_card',
        data: {
          id: u.id,
          name: u.name,
          username: u.username,
          avatar: u.avatar_data || '',
          profession: u.profession || 'Miembro de Link',
          city: u.city || '',
          bio: u.bio || '',
          verified: u.verified || false,
          is_admin: u.is_admin || u.role === 'admin',
          role: u.role || 'user',
          interests: ints,
          instagram: links.instagram || u.instagram || null,
          telegram: links.telegram || null,
          whatsapp: links.telefono ? `${links.codigoPais || '+53'}${links.telefono}` : (u.phone ? `${u.country_code || '+53'}${u.phone}` : null),
          url: `/perfil/${u.id}`
        }
      };
    }

    return {
      type: 'social_profile_card',
      data: {
        name: cleanTerm,
        username: cleanTerm,
        avatar: '',
        profession: 'Perfil público',
        city: 'Redes Sociales',
        bio: `Información de perfil público para @${cleanTerm}.`,
        verified: false,
        instagram: cleanTerm,
        url: `https://instagram.com/${cleanTerm}`
      }
    };
  } catch (err) {
    console.error('Error en social.profile:', err);
    return { error: 'Error al consultar perfil social.' };
  }
}

async function searchUsersByInterest(interest, limit = 10) {
  const cleanInterest = (interest || '').trim();
  if (!cleanInterest) return { error: 'Interés o gusto no proporcionado.' };

  try {
    const { rows } = await query(
      `SELECT id, name, username, avatar_data, profession, city, verified, is_admin, role, interests
       FROM users
       WHERE interests::text ILIKE $1
          OR hobbies::text ILIKE $1
          OR bio ILIKE $1
          OR profession ILIKE $1
       ORDER BY verified DESC, created_at DESC
       LIMIT $2`,
      [`%${cleanInterest}%`, limit]
    );

    const users = rows.map(u => ({
      id: u.id,
      name: u.name,
      username: u.username,
      avatar: u.avatar_data || '',
      profession: u.profession || 'Miembro de Link',
      city: u.city || '',
      verified: u.verified || false,
      is_admin: u.is_admin || u.role === 'admin',
      role: u.role || 'user',
    }));

    return {
      type: 'user_search_results',
      data: {
        interest: cleanInterest,
        count: users.length,
        users,
      }
    };
  } catch (err) {
    console.error('Error en searchUsersByInterest:', err);
    return { error: 'Error al buscar personas por interés.' };
  }
}

async function searchPosts(keyword, limit = 10) {
  const cleanKeyword = (keyword || '').trim();
  if (!cleanKeyword) return { error: 'Término de búsqueda para publicaciones no proporcionado.' };

  try {
    const { rows } = await query(
      `SELECT p.id, p.text, p.media_url, p.created_at, u.name AS autor_nombre, u.avatar_data AS autor_avatar,
              (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS total_likes,
              (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) AS total_comentarios
       FROM posts p
       JOIN users u ON u.id = p.user_id
       WHERE p.text ILIKE $1
       ORDER BY p.created_at DESC
       LIMIT $2`,
      [`%${cleanKeyword}%`, limit]
    );

    return {
      type: 'posts_search_results',
      data: {
        keyword: cleanKeyword,
        count: rows.length,
        posts: rows,
      }
    };
  } catch (err) {
    console.error('Error en searchPosts:', err);
    return { error: 'Error al buscar publicaciones.' };
  }
}

module.exports = { getProfile, searchUsersByInterest, searchPosts };
