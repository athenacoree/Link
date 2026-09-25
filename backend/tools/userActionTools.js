/**
 * Herramientas de Acciones de Usuario e Interacciones en la Red (Perfil, Estados, Chat, Amistad)
 */
const { query } = require('../db/postgres');

function conversationId(a, b) {
  return [a, b].sort().join('_');
}

// 1. Previsualizar Chat con otra persona y permitir responder
async function getChatPreview({ username, userId }, requesterId = null) {
  if (!requesterId) {
    return { error: 'Se requiere estar autenticado para ver la conversación.' };
  }

  try {
    let targetUser = null;
    if (userId) {
      const { rows } = await query('SELECT id, name, username, avatar_data FROM users WHERE id = $1', [userId]);
      if (rows.length) targetUser = rows[0];
    }
    if (!targetUser && username) {
      const cleanU = username.replace(/^@/, '').trim();
      const { rows } = await query(
        `SELECT id, name, username, avatar_data FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(name) ILIKE $2 LIMIT 1`,
        [cleanU, `%${cleanU}%`]
      );
      if (rows.length) targetUser = rows[0];
    }

    if (!targetUser) {
      return { error: `No se encontró al usuario '${username || userId}' para ver el chat.` };
    }

    const convId = conversationId(requesterId, targetUser.id);
    const { rows: msgs } = await query(
      `SELECT id, sender_id, text, image_data, audio_data, created_at
       FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at DESC
       LIMIT 6`,
      [convId]
    );

    const sortedMsgs = msgs.reverse().map(m => ({
      id: m.id,
      text: m.text || (m.image_data ? '[Foto]' : m.audio_data ? '[Audio]' : ''),
      sender_id: m.sender_id,
      is_me: m.sender_id === requesterId,
      created_at: m.created_at,
    }));

    return {
      type: 'chat_preview_card',
      data: {
        target_id: targetUser.id,
        target_name: targetUser.name,
        target_username: targetUser.username,
        target_avatar: targetUser.avatar_data || '',
        messages: sortedMsgs,
      }
    };
  } catch (err) {
    console.error('Error en chat.preview:', err);
    return { error: 'Ocurrió un error al cargar la vista previa del chat.' };
  }
}

// 2. Editar perfil del usuario
async function editUserProfile(params = {}, requesterId = null) {
  if (!requesterId) {
    return { error: 'Se requiere estar autenticado para editar tu perfil.' };
  }

  const { name, bio, profession, city, skin_color, gender } = params;
  const updates = [];
  const sqlValues = [];
  let paramIdx = 1;

  if (name && name.trim()) { updates.push(`name = $${paramIdx++}`); sqlValues.push(name.trim()); }
  if (bio !== undefined) { updates.push(`bio = $${paramIdx++}`); sqlValues.push(bio.trim()); }
  if (profession !== undefined) { updates.push(`profession = $${paramIdx++}`); sqlValues.push(profession.trim()); }
  if (city !== undefined) { updates.push(`city = $${paramIdx++}`); sqlValues.push(city.trim()); }
  if (skin_color !== undefined) { updates.push(`skin_color = $${paramIdx++}`); sqlValues.push(skin_color.trim()); }
  if (gender !== undefined) { updates.push(`gender = $${paramIdx++}`); sqlValues.push(gender.trim()); }

  if (!updates.length) {
    return { error: 'No se enviaron campos para actualizar en el perfil.' };
  }

  try {
    sqlValues.push(requesterId);
    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING id, name, username, bio, profession, city, skin_color, gender`;
    const { rows } = await query(sql, sqlValues);

    if (!rows.length) return { error: 'Usuario no encontrado.' };

    return {
      type: 'profile_updated_card',
      data: {
        user: rows[0],
        message: '¡Tu perfil ha sido actualizado correctamente!',
      }
    };
  } catch (err) {
    console.error('Error en user.edit_profile:', err);
    return { error: 'Error al actualizar la información del perfil.' };
  }
}

// 3. Crear / publicar estado (Story)
async function createStatus({ text, duration_hours = 24 }, requesterId = null) {
  if (!requesterId) {
    return { error: 'Se requiere estar autenticado para publicar un estado.' };
  }
  const cleanText = (text || '').trim();
  if (!cleanText) {
    return { error: 'Proporciona el texto o mensaje de tu estado.' };
  }

  const dur = [12, 24, 48].includes(Number(duration_hours)) ? Number(duration_hours) : 24;

  try {
    const { rows } = await query(
      `INSERT INTO stories (user_id, text, duration_hours, expires_at)
       VALUES ($1, $2, $3, now() + ($3 || ' hours')::INTERVAL)
       RETURNING id, text, duration_hours, expires_at, created_at`,
      [requesterId, cleanText, dur]
    );

    await query('UPDATE users SET status_text = $1, status_updated_at = now() WHERE id = $2', [cleanText, requesterId]);

    return {
      type: 'status_created_card',
      data: {
        id: rows[0].id,
        text: rows[0].text,
        duration_hours: rows[0].duration_hours,
        expires_at: rows[0].expires_at,
        message: '¡Tu nuevo estado ha sido publicado en la red!',
      }
    };
  } catch (err) {
    console.error('Error en status.create:', err);
    return { error: 'No se pudo crear el estado.' };
  }
}

// 4. Eliminar estado
async function deleteStatus({ id }, requesterId = null) {
  if (!requesterId) {
    return { error: 'Se requiere estar autenticado para eliminar tu estado.' };
  }

  try {
    let targetId = id;
    if (!targetId) {
      // Si no proporcionó ID, buscar el estado más reciente vigente del usuario
      const { rows: lastStories } = await query(
        `SELECT id FROM stories WHERE user_id = $1 AND expires_at > now() ORDER BY created_at DESC LIMIT 1`,
        [requesterId]
      );
      if (lastStories.length) targetId = lastStories[0].id;
    }

    if (!targetId) {
      return { error: 'No tienes ningún estado activo para eliminar.' };
    }

    const { rows: story } = await query('SELECT * FROM stories WHERE id = $1', [targetId]);
    if (!story.length) return { error: 'El estado especificado no existe.' };

    const { rows: u } = await query('SELECT is_admin, role FROM users WHERE id = $1', [requesterId]);
    const esDueno = story[0].user_id === requesterId;
    const esAdmin = u[0]?.is_admin || u[0]?.role === 'admin';

    if (!esDueno && !esAdmin) {
      return { error: 'No tienes permiso para borrar este estado.' };
    }

    await query('DELETE FROM stories WHERE id = $1', [targetId]);

    const { rows: vigentes } = await query(
      'SELECT text FROM stories WHERE user_id = $1 AND expires_at > now() ORDER BY created_at DESC LIMIT 1',
      [story[0].user_id]
    );
    if (vigentes.length) {
      await query('UPDATE users SET status_text = $1 WHERE id = $2', [vigentes[0].text || '📷', story[0].user_id]);
    } else {
      await query('UPDATE users SET status_text = NULL, status_updated_at = NULL WHERE id = $1', [story[0].user_id]);
    }

    return {
      type: 'status_deleted_card',
      data: {
        id: targetId,
        message: 'El estado ha sido eliminado con éxito.',
      }
    };
  } catch (err) {
    console.error('Error en status.delete:', err);
    return { error: 'Error al eliminar el estado.' };
  }
}

// 5. Enviar solicitud de amistad mediante IA
async function sendFriendRequest({ username, userId }, requesterId = null) {
  if (!requesterId) {
    return { error: 'Se requiere estar autenticado para enviar solicitudes de amistad.' };
  }

  try {
    let targetUser = null;
    if (userId) {
      const { rows } = await query('SELECT id, name, username FROM users WHERE id = $1', [userId]);
      if (rows.length) targetUser = rows[0];
    }
    if (!targetUser && username) {
      const cleanU = username.replace(/^@/, '').trim();
      const { rows } = await query(
        `SELECT id, name, username FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(name) ILIKE $2 LIMIT 1`,
        [cleanU, `%${cleanU}%`]
      );
      if (rows.length) targetUser = rows[0];
    }

    if (!targetUser) {
      return { error: `No se encontró al usuario '${username || userId}'.` };
    }

    if (targetUser.id === requesterId) {
      return { error: 'No puedes enviarte una solicitud de amistad a ti mismo.' };
    }

    const sortFn = (x, y) => (x < y ? [x, y] : [y, x]);
    const [a, b] = sortFn(requesterId, targetUser.id);

    const existing = await query('SELECT * FROM friendships WHERE user_a=$1 AND user_b=$2', [a, b]);
    if (existing.rows.length) {
      const f = existing.rows[0];
      if (f.status === 'amigos') return { error: `Ya eres amigo/a de ${targetUser.name}.` };
      if (f.status === 'pendiente') return { error: `Ya existe una solicitud pendiente con ${targetUser.name}.` };
    }

    const { rows: fRows } = await query(
      `INSERT INTO friendships (user_a, user_b, status, requested_by)
       VALUES ($1,$2,'pendiente',$3)
       ON CONFLICT (user_a, user_b) DO UPDATE SET status='pendiente', requested_by=$3, updated_at=now()
       RETURNING *`,
      [a, b, requesterId]
    );

    const yo = await query('SELECT name FROM users WHERE id=$1', [requesterId]);
    await query(
      `INSERT INTO notifications (user_id, actor_id, type, text, data) VALUES ($1,$2,$3,$4,$5)`,
      [targetUser.id, requesterId, 'solicitud_amistad', `${yo.rows[0].name} te envió una solicitud de amistad por IA`, { friendship_id: fRows[0].id }]
    );

    return {
      type: 'friend_request_sent_card',
      data: {
        target_id: targetUser.id,
        target_name: targetUser.name,
        target_username: targetUser.username,
        message: `Solicitud de amistad enviada a ${targetUser.name} (@${targetUser.username}) 🎉`,
      }
    };
  } catch (err) {
    console.error('Error en friend.send_request:', err);
    return { error: 'Error al enviar la solicitud de amistad.' };
  }
}

// 6. Agendar Cita o Compromiso
async function createAppointment({ guest_username, title, description, location, scheduled_at }, requesterId = null) {
  if (!requesterId) return { error: 'Se requiere estar autenticado para agendar una cita.' };
  try {
    let guestUser = null;
    if (guest_username) {
      const cleanU = guest_username.replace(/^@/, '').trim();
      const { rows } = await query(
        `SELECT id, name, username FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(name) ILIKE $2 LIMIT 1`,
        [cleanU, `%${cleanU}%`]
      );
      if (rows.length) guestUser = rows[0];
    }
    if (!guestUser) {
      return { error: `No se encontró al usuario '${guest_username || 'invitado'}' para agendar la cita.` };
    }
    const { rows } = await query(
      `INSERT INTO appointments (host_id, guest_id, title, description, location, scheduled_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pendiente')
       RETURNING *`,
      [requesterId, guestUser.id, title || 'Cita / Reunión', description || '', location || '', scheduled_at || new Date()]
    );
    return {
      type: 'appointment_created_card',
      data: {
        appointment: rows[0],
        guest_name: guestUser.name,
        message: `¡Cita agendada con ${guestUser.name}! Invitación enviada.`
      }
    };
  } catch (err) {
    console.error('Error en appointment.create:', err);
    return { error: 'Error al agendar la cita.' };
  }
}

// 7. Crear Recordatorio
async function createReminder({ title, note, scheduled_at }, requesterId = null) {
  if (!requesterId) return { error: 'Se requiere estar autenticado para crear un recordatorio.' };
  try {
    const { rows } = await query(
      `INSERT INTO notifications (user_id, type, title, body, data)
       VALUES ($1, 'reminder', $2, $3, $4)
       RETURNING *`,
      [
        requesterId,
        '⏰ Recordatorio',
        title || 'Recordatorio programado',
        JSON.stringify({ note: note || '', scheduled_at: scheduled_at || new Date() })
      ]
    );
    return {
      type: 'reminder_created_card',
      data: {
        reminder: rows[0],
        message: `⏰ Recordatorio programado: "${title || 'Sin título'}"`
      }
    };
  } catch (err) {
    console.error('Error en reminder.create:', err);
    return { error: 'Error al programar el recordatorio.' };
  }
}

module.exports = {
  getChatPreview,
  editUserProfile,
  createStatus,
  deleteStatus,
  sendFriendRequest,
  createAppointment,
  createReminder,
};
