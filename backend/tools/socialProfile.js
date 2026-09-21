/**
 * Herramienta: social.profile()
 * Consulta segura de información pública/autorizada de perfiles
 */
const { query } = require('../db/postgres');

async function getProfile(username, requesterId = null) {
  const cleanUsername = (username || '').replace(/^@/, '').trim();
  if (!cleanUsername) return { error: 'Nombre de usuario no proporcionado.' };

  try {
    const { rows } = await query(
      `SELECT id, name, username, avatar_data, profession, city, bio, verified, social_links, created_at
       FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(name) = LOWER($1) LIMIT 1`,
      [cleanUsername]
    );

    if (rows.length > 0) {
      const u = rows[0];
      let links = {};
      try {
        links = typeof u.social_links === 'string' ? JSON.parse(u.social_links) : (u.social_links || {});
      } catch (e) {}

      return {
        type: 'social_profile_card',
        data: {
          name: u.name,
          username: u.username,
          avatar: u.avatar_data || '',
          profession: u.profession || 'Miembro de Link',
          city: u.city || '',
          bio: u.bio || '',
          verified: u.verified || false,
          instagram: links.instagram || null,
          telegram: links.telegram || null,
          whatsapp: links.telefono ? `${links.codigoPais || '+53'}${links.telefono}` : null,
          url: `/perfil/${u.id}`
        }
      };
    }

    return {
      type: 'social_profile_card',
      data: {
        name: cleanUsername,
        username: cleanUsername,
        avatar: '',
        profession: 'Perfil público',
        city: 'Redes Sociales',
        bio: `Información de perfil público para @${cleanUsername}.`,
        verified: false,
        instagram: cleanUsername,
        url: `https://instagram.com/${cleanUsername}`
      }
    };
  } catch (err) {
    return { error: 'Error al consultar perfil social.' };
  }
}

module.exports = { getProfile };
