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

module.exports = { getProfile };
