const express = require('express');
const router = express.Router();
const { query } = require('../db/postgres');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Catálogo base de misiones
const CATALOGO_MISIONES = [
  {
    key: 'complete_profile',
    title: 'Perfil Completo 🌟',
    description: 'Completa tu información obligatoria (nombre de usuario, género, ciudad e intereses).',
    reward_badge: 'Perfil Estrella',
    target: 1,
    icon: '👤'
  },
  {
    key: 'discover_soccer',
    title: 'Fanático del Fútbol ⚽',
    description: 'Descubre o contacta a una persona en Link a la que también le guste el fútbol.',
    reward_badge: 'Goleador Link',
    target: 1,
    icon: '⚽'
  },
  {
    key: 'send_3_messages',
    title: 'Romper el Hielo 💬',
    description: 'Envía al menos 3 mensajes en tus chats de conversación.',
    reward_badge: 'Conversador Activo',
    target: 3,
    icon: '💬'
  },
  {
    key: 'publish_story',
    title: 'Creador de Historias 📸',
    description: 'Comparte un estado o historia con tus amigos.',
    reward_badge: 'Storyteller',
    target: 1,
    icon: '📸'
  },
  {
    key: 'connect_similar_interests',
    title: 'Alma Gemela 🤝',
    description: 'Conecta o agrega a un amigo con tus mismos intereses o pasatiempos.',
    reward_badge: 'Sinergia',
    target: 1,
    icon: '🤝'
  }
];

// Obtener estado global de misiones y misiones del usuario
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;

    // 1. Verificar si la función está activada globalmente por el Administrador
    const settingRes = await query("SELECT value FROM system_settings WHERE key = 'missions_enabled'");
    const missionsEnabled = settingRes.rows.length ? settingRes.rows[0].value === 'true' : true;

    // 2. Obtener datos del usuario y preferencia personal de participación
    const userRes = await query("SELECT onboarding_complete, interests, extra FROM users WHERE id = $1", [userId]);
    if (!userRes.rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });

    const user = userRes.rows[0];
    const userExtra = user.extra || {};
    const missionsParticipant = userExtra.missions_participant !== false; // por defecto true

    if (!missionsEnabled || !missionsParticipant) {
      return res.json({
        ok: true,
        missions_enabled: missionsEnabled,
        missions_participant: missionsParticipant,
        missions: []
      });
    }

    // 3. Obtener progreso en DB
    const existingMissionsRes = await query("SELECT * FROM user_missions WHERE user_id = $1", [userId]);
    const userMissionsMap = {};
    for (const m of existingMissionsRes.rows) {
      userMissionsMap[m.mission_key] = m;
    }

    // 4. Calcular avance real en vivo para cada misión
    const userInterests = Array.isArray(user.interests) ? user.interests : [];
    const likesSoccer = userInterests.some(i => String(i).toLowerCase().includes('fútb') || String(i).toLowerCase().includes('futb') || String(i).toLowerCase().includes('soccer'));

    // Conteo de mensajes
    const msgRes = await query("SELECT COUNT(*)::int AS total FROM messages WHERE sender_id = $1", [userId]);
    const msgCount = msgRes.rows[0] ? msgRes.rows[0].total : 0;

    // Conteo de historias
    const storyRes = await query("SELECT COUNT(*)::int AS total FROM stories WHERE user_id = $1", [userId]);
    const storyCount = storyRes.rows[0] ? storyRes.rows[0].total : 0;

    // Búsqueda de coincidencia en fútbol u otros intereses
    const soccerMatchRes = await query(`
      SELECT u.id FROM users u
      JOIN friendships f ON (f.user_a = u.id OR f.user_b = u.id)
      WHERE (f.user_a = $1 OR f.user_b = $1)
        AND f.status = 'amigos'
        AND u.id != $1
        AND (u.interests::text ILIKE '%fútb%' OR u.interests::text ILIKE '%futb%' OR u.interests::text ILIKE '%soccer%')
      LIMIT 1
    `, [userId]);
    const foundSoccerMatch = soccerMatchRes.rows.length > 0;

    const resultMissions = [];

    for (const cat of CATALOGO_MISIONES) {
      let liveProgress = 0;

      if (cat.key === 'complete_profile') {
        liveProgress = user.onboarding_complete ? 1 : 0;
      } else if (cat.key === 'discover_soccer') {
        liveProgress = foundSoccerMatch ? 1 : (likesSoccer ? 1 : 0);
      } else if (cat.key === 'send_3_messages') {
        liveProgress = Math.min(cat.target, msgCount);
      } else if (cat.key === 'publish_story') {
        liveProgress = Math.min(cat.target, storyCount);
      } else if (cat.key === 'connect_similar_interests') {
        liveProgress = userInterests.length > 0 ? 1 : 0;
      }

      const existing = userMissionsMap[cat.key];
      const completed = liveProgress >= cat.target;
      const claimed = existing ? existing.claimed : false;

      // Actualizar o guardar en DB
      await query(`
        INSERT INTO user_missions (user_id, mission_key, progress, target, completed, claimed, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, now())
        ON CONFLICT (user_id, mission_key) DO UPDATE
        SET progress = EXCLUDED.progress, completed = EXCLUDED.completed, updated_at = now()
      `, [userId, cat.key, liveProgress, cat.target, completed, claimed]);

      resultMissions.push({
        ...cat,
        progress: liveProgress,
        completed,
        claimed
      });
    }

    res.json({
      ok: true,
      missions_enabled: missionsEnabled,
      missions_participant: missionsParticipant,
      missions: resultMissions
    });
  } catch (err) {
    console.error('[Misiones] Error al obtener misiones:', err);
    res.status(500).json({ error: 'No se pudieron cargar las misiones.' });
  }
});

// Cambiar la participación del usuario (activar / desactivar)
router.post('/toggle-participation', requireAuth, async (req, res) => {
  try {
    const { participate } = req.body;
    const userId = req.userId;

    const userRes = await query("SELECT extra FROM users WHERE id = $1", [userId]);
    if (!userRes.rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });

    const currentExtra = userRes.rows[0].extra || {};
    currentExtra.missions_participant = Boolean(participate);

    await query("UPDATE users SET extra = $1 WHERE id = $2", [JSON.stringify(currentExtra), userId]);

    res.json({ ok: true, missions_participant: currentExtra.missions_participant });
  } catch (err) {
    console.error('[Misiones] Error al cambiar participación:', err);
    res.status(500).json({ error: 'Error al actualizar participación en misiones.' });
  }
});

// Reclamar recompensa de misión completada
router.post('/:key/claim', requireAuth, async (req, res) => {
  try {
    const { key } = req.params;
    const userId = req.userId;

    const missionRes = await query("SELECT * FROM user_missions WHERE user_id = $1 AND mission_key = $2", [userId, key]);
    if (!missionRes.rows.length) {
      return res.status(404).json({ error: 'Misión no encontrada o aún no iniciada.' });
    }

    const m = missionRes.rows[0];
    if (!m.completed) {
      return res.status(400).json({ error: 'Aún no has completado el objetivo de esta misión.' });
    }
    if (m.claimed) {
      return res.status(400).json({ error: 'Ya has reclamado la recompensa de esta misión.' });
    }

    await query("UPDATE user_missions SET claimed = true, updated_at = now() WHERE user_id = $1 AND mission_key = $2", [userId, key]);

    const cat = CATALOGO_MISIONES.find(item => item.key === key) || {};

    // Otorgar badge si corresponde
    if (cat.reward_badge) {
      await query(`
        INSERT INTO user_badges (user_id, badge_key, title, icon)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT DO NOTHING
      `, [userId, `mision_${key}`, cat.reward_badge, cat.icon || '🏆']).catch(() => {});
    }

    res.json({
      ok: true,
      claimed: true,
      badge: cat.reward_badge,
      message: `¡Felicidades! Has completado la misión: ${cat.title}`
    });
  } catch (err) {
    console.error('[Misiones] Error al reclamar recompensa:', err);
    res.status(500).json({ error: 'No se pudo reclamar la recompensa.' });
  }
});

// Admin: Activar / Desactivar el modo Misiones globalmente
router.post('/admin/toggle-global', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { enabled } = req.body;
    const val = enabled ? 'true' : 'false';

    await query(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES ('missions_enabled', $1, now())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `, [val]);

    res.json({ ok: true, missions_enabled: enabled });
  } catch (err) {
    console.error('[Misiones] Error toggle admin global:', err);
    res.status(500).json({ error: 'Error al cambiar estado global de misiones.' });
  }
});

module.exports = router;
