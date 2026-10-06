/**
 * Servicio para gestión de Canales de YouTube en Link Video
 */

const { query } = require('../db/postgres');
const { extractYouTubeId, isValidYouTubeUrl } = require('../utils/youtube');

// Canales predeterminados
const DEFAULT_CHANNELS = [
  { channel_id: 'principal', channel_name: 'Canal Principal' },
  { channel_id: 'musica', channel_name: 'Canal Música' },
  { channel_id: 'cine', channel_name: 'Canal Cine' },
  { channel_id: 'entretenimiento', channel_name: 'Canal Entretenimiento' }
];

// In-memory store fallback si PostgreSQL no está disponible
const memoryChannels = new Map(
  DEFAULT_CHANNELS.map(ch => [
    ch.channel_id,
    {
      channel_id: ch.channel_id,
      channel_name: ch.channel_name,
      video_id: null,
      title: '',
      started_at: null,
      is_active: false,
      updated_at: new Date().toISOString()
    }
  ])
);

/**
 * Formatea el objeto de canal agregando el tiempo transcurrido (currentTime en segundos)
 */
function formatChannelOutput(channel) {
  if (!channel) return null;

  let currentTime = 0;
  if (channel.is_active && channel.started_at) {
    const started = new Date(channel.started_at).getTime();
    const now = Date.now();
    if (!isNaN(started) && now > started) {
      currentTime = Math.floor((now - started) / 1000);
    }
  }

  return {
    channel_id: channel.channel_id,
    channel_name: channel.channel_name || channel.channel_id,
    video_id: channel.video_id || null,
    title: channel.title || '',
    started_at: channel.started_at || null,
    is_active: !!channel.is_active,
    updated_at: channel.updated_at || new Date().toISOString(),
    currentTime
  };
}

/**
 * Obtiene la lista de todos los canales de YouTube con su estado actual
 */
async function getChannels() {
  try {
    const { rows } = await query(
      `SELECT channel_id, channel_name, video_id, title, started_at, is_active, updated_at
       FROM youtube_channels
       ORDER BY channel_id ASC`
    );
    if (rows && rows.length > 0) {
      return rows.map(formatChannelOutput);
    }
  } catch (err) {
    // Usar in-memory fallback
  }

  return Array.from(memoryChannels.values()).map(formatChannelOutput);
}

/**
 * Obtiene el estado de un canal por su ID
 */
async function getChannelById(channelId) {
  try {
    const { rows } = await query(
      `SELECT channel_id, channel_name, video_id, title, started_at, is_active, updated_at
       FROM youtube_channels
       WHERE channel_id = $1`,
      [channelId]
    );
    if (rows && rows.length > 0) {
      return formatChannelOutput(rows[0]);
    }
  } catch (err) {
    if (memoryChannels.has(channelId)) {
      return formatChannelOutput(memoryChannels.get(channelId));
    }
  }

  return memoryChannels.has(channelId) ? formatChannelOutput(memoryChannels.get(channelId)) : null;
}

/**
 * Asigna/Inicia un video de YouTube en un canal específico
 */
async function setChannelVideo({ channelId, url, title }) {
  const videoId = extractYouTubeId(url);
  if (!videoId) {
    throw new Error('La URL provista no es una URL de YouTube válida.');
  }

  const cleanTitle = (title || '').trim() || `YouTube Video (${videoId})`;
  const nowIso = new Date().toISOString();

  let updatedChannel = null;

  try {
    const { rows } = await query(
      `INSERT INTO youtube_channels (channel_id, channel_name, video_id, title, started_at, is_active, updated_at)
       VALUES ($1, $1, $2, $3, now(), true, now())
       ON CONFLICT (channel_id) DO UPDATE
       SET video_id = EXCLUDED.video_id,
           title = EXCLUDED.title,
           started_at = now(),
           is_active = true,
           updated_at = now()
       RETURNING channel_id, channel_name, video_id, title, started_at, is_active, updated_at`,
      [channelId, videoId, cleanTitle]
    );
    if (rows && rows.length > 0) {
      updatedChannel = rows[0];
    }
  } catch (err) {
    // Fallback a memoria
    const current = memoryChannels.get(channelId) || {
      channel_id: channelId,
      channel_name: DEFAULT_CHANNELS.find(c => c.channel_id === channelId)?.channel_name || channelId
    };
    current.video_id = videoId;
    current.title = cleanTitle;
    current.started_at = nowIso;
    current.is_active = true;
    current.updated_at = nowIso;
    memoryChannels.set(channelId, current);
    updatedChannel = current;
  }

  return formatChannelOutput(updatedChannel);
}

/**
 * Detiene/finaliza el contenido activo de un canal
 */
async function stopChannelVideo(channelId) {
  const nowIso = new Date().toISOString();
  let updatedChannel = null;

  try {
    const { rows } = await query(
      `UPDATE youtube_channels
       SET is_active = false,
           updated_at = now()
       WHERE channel_id = $1
       RETURNING channel_id, channel_name, video_id, title, started_at, is_active, updated_at`,
      [channelId]
    );
    if (rows && rows.length > 0) {
      updatedChannel = rows[0];
    }
  } catch (err) {
    if (memoryChannels.has(channelId)) {
      const current = memoryChannels.get(channelId);
      current.is_active = false;
      current.updated_at = nowIso;
      updatedChannel = current;
    }
  }

  return formatChannelOutput(updatedChannel);
}

module.exports = {
  getChannels,
  getChannelById,
  setChannelVideo,
  stopChannelVideo,
  extractYouTubeId,
  isValidYouTubeUrl
};
