const express = require('express');
const router = express.Router();
const pool = require('../db/postgres');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// 1. Encuestas (Polls)
router.post('/polls', requireAuth, async (req, res) => {
    const { postId, question, options, multipleChoice, endsAt } = req.body;
    const result = await pool.query(
        `INSERT INTO polls (post_id, question, options, multiple_choice, ends_at)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [postId, question, JSON.stringify(options), multipleChoice || false, endsAt || null]
    );
    res.json({ ok: true, poll: result.rows[0] });
});

router.post('/polls/:id/vote', requireAuth, async (req, res) => {
    const pollId = req.params.id;
    const { optionIndex } = req.body;
    const userId = req.userId;

    const pollRes = await pool.query('SELECT * FROM polls WHERE id = $1', [pollId]);
    if (pollRes.rows.length === 0) return res.status(404).json({ error: 'Encuesta no encontrada' });

    const poll = pollRes.rows[0];
    let votes = poll.votes || {};
    votes[userId] = optionIndex;

    const updated = await pool.query(
        'UPDATE polls SET votes = $1 WHERE id = $2 RETURNING *',
        [JSON.stringify(votes), pollId]
    );
    res.json({ ok: true, poll: updated.rows[0] });
});

// 2. Guardar / Marcadores de Publicaciones
router.post('/posts/:id/save', requireAuth, async (req, res) => {
    const postId = req.params.id;
    const userId = req.userId;
    await pool.query(
        'INSERT INTO saved_posts (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, postId]
    );
    res.json({ ok: true, saved: true });
});

router.delete('/posts/:id/save', requireAuth, async (req, res) => {
    const postId = req.params.id;
    const userId = req.userId;
    await pool.query('DELETE FROM saved_posts WHERE user_id = $1 AND post_id = $2', [userId, postId]);
    res.json({ ok: true, saved: false });
});

router.get('/saved-posts', requireAuth, async (req, res) => {
    const userId = req.userId;
    const result = await pool.query(
        `SELECT p.*, u.username, u.avatar, u.nombre
         FROM saved_posts sp
         JOIN posts p ON sp.post_id = p.id
         JOIN users u ON p.user_id = u.id
         WHERE sp.user_id = $1
         ORDER BY sp.created_at DESC`,
        [userId]
    );
    res.json({ ok: true, savedPosts: result.rows });
});

// 3. Grupos de Chat
router.post('/chat-groups', requireAuth, async (req, res) => {
    const { name, description, avatar, members } = req.body;
    const userId = req.userId;
    const initialMembers = Array.from(new Set([...(members || []), userId]));

    const result = await pool.query(
        `INSERT INTO chat_groups (name, description, avatar, created_by, members)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [name, description, avatar, userId, JSON.stringify(initialMembers)]
    );
    res.json({ ok: true, group: result.rows[0] });
});

router.get('/chat-groups', requireAuth, async (req, res) => {
    const userId = req.userId;
    const result = await pool.query(
        `SELECT * FROM chat_groups WHERE members @> $1::jsonb ORDER BY created_at DESC`,
        [JSON.stringify([userId])]
    );
    res.json({ ok: true, groups: result.rows });
});

// 4. Badges / Logros
router.get('/users/:id/badges', async (req, res) => {
    const userId = req.params.id;
    const result = await pool.query('SELECT * FROM user_badges WHERE user_id = $1 ORDER BY granted_at DESC', [userId]);
    res.json({ ok: true, badges: result.rows });
});

router.post('/users/:id/badges', requireAuth, requireAdmin, async (req, res) => {
    const userId = req.params.id;
    const { badgeKey, title, icon } = req.body;
    const result = await pool.query(
        'INSERT INTO user_badges (user_id, badge_key, title, icon) VALUES ($1, $2, $3, $4) RETURNING *',
        [userId, badgeKey, title, icon]
    );
    res.json({ ok: true, badge: result.rows[0] });
});

// 5. Bloqueos de Usuario
router.post('/users/:id/block', requireAuth, async (req, res) => {
    const blockedUserId = req.params.id;
    const userId = req.userId;
    if (userId == blockedUserId) return res.status(400).json({ error: 'No puedes bloquearte a ti mismo' });
    await pool.query(
        'INSERT INTO blocked_users (user_id, blocked_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, blockedUserId]
    );
    res.json({ ok: true, blocked: true });
});

router.delete('/users/:id/block', requireAuth, async (req, res) => {
    const blockedUserId = req.params.id;
    const userId = req.userId;
    await pool.query('DELETE FROM blocked_users WHERE user_id = $1 AND blocked_user_id = $2', [userId, blockedUserId]);
    res.json({ ok: true, blocked: false });
});

router.get('/blocked-users', requireAuth, async (req, res) => {
    const userId = req.userId;
    const result = await pool.query(
        `SELECT u.id, u.username, u.nombre, u.avatar
         FROM blocked_users bu
         JOIN users u ON bu.blocked_user_id = u.id
         WHERE bu.user_id = $1`,
        [userId]
    );
    res.json({ ok: true, blockedUsers: result.rows });
});

// 6. Historias Destacadas (Highlights)
router.post('/story-highlights', requireAuth, async (req, res) => {
    const { title, coverImage, storyIds } = req.body;
    const userId = req.userId;
    const result = await pool.query(
        `INSERT INTO story_highlights (user_id, title, cover_image, story_ids)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [userId, title, coverImage, JSON.stringify(storyIds || [])]
    );
    res.json({ ok: true, highlight: result.rows[0] });
});

router.get('/users/:id/story-highlights', async (req, res) => {
    const userId = req.params.id;
    const result = await pool.query('SELECT * FROM story_highlights WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    res.json({ ok: true, highlights: result.rows });
});

// 7. Publicaciones Programadas
router.post('/scheduled-posts', requireAuth, async (req, res) => {
    const { content, mediaUrl, scheduledFor } = req.body;
    const userId = req.userId;
    const result = await pool.query(
        `INSERT INTO scheduled_posts (user_id, content, media_url, scheduled_for)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [userId, content, mediaUrl, scheduledFor]
    );
    res.json({ ok: true, scheduledPost: result.rows[0] });
});

router.get('/scheduled-posts', requireAuth, async (req, res) => {
    const userId = req.userId;
    const result = await pool.query(
        'SELECT * FROM scheduled_posts WHERE user_id = $1 AND published = FALSE ORDER BY scheduled_for ASC',
        [userId]
    );
    res.json({ ok: true, scheduledPosts: result.rows });
});

// 8. Traductor de Publicación (Simulación)
router.post('/posts/:id/translate', requireAuth, async (req, res) => {
    const { targetLang } = req.body;
    const postId = req.params.id;
    const postRes = await pool.query('SELECT content FROM posts WHERE id = $1', [postId]);
    if (postRes.rows.length === 0) return res.status(404).json({ error: 'Post no encontrado' });

    const originalText = postRes.rows[0].content || '';
    const translatedText = `[${(targetLang || 'ES').toUpperCase()}] ${originalText}`;
    res.json({ ok: true, originalText, translatedText, lang: targetLang || 'es' });
});

// 9. Exportación Completa de Datos de Usuario
router.get('/user/export-data', requireAuth, async (req, res) => {
    const userId = req.userId;
    const userRes = await pool.query('SELECT id, username, nombre, email, bio, extra, created_at FROM users WHERE id = $1', [userId]);
    const postsRes = await pool.query('SELECT * FROM posts WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    const friendsRes = await pool.query('SELECT * FROM friendships WHERE user_id = $1 OR friend_id = $1', [userId]);

    const exportPackage = {
        profile: userRes.rows[0] || {},
        posts: postsRes.rows,
        friendsCount: friendsRes.rows.length,
        exportedAt: new Date().toISOString(),
        version: '2.0.0'
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=enlace_user_data_${userId}.json`);
    res.send(JSON.stringify(exportPackage, null, 2));
});

// 10. Dashboard de Métricas y Analítica Admin
router.get('/admin/analytics', requireAuth, requireAdmin, async (req, res) => {

    const totalUsers = await pool.query('SELECT COUNT(*) FROM users');
    const totalPosts = await pool.query('SELECT COUNT(*) FROM posts');
    const totalPolls = await pool.query('SELECT COUNT(*) FROM polls');
    const totalGroups = await pool.query('SELECT COUNT(*) FROM chat_groups');
    const activeToday = await pool.query("SELECT COUNT(DISTINCT user_id) FROM user_activity_logs WHERE created_at >= NOW() - INTERVAL '24 hours'");

    res.json({
        ok: true,
        analytics: {
            totalUsers: parseInt(totalUsers.rows[0].count),
            totalPosts: parseInt(totalPosts.rows[0].count),
            totalPolls: parseInt(totalPolls.rows[0].count),
            totalGroups: parseInt(totalGroups.rows[0].count),
            activeTodayUsers: parseInt(activeToday.rows[0].count || 0)
        }
    });
});

module.exports = router;
