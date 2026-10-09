package com.enlace.bridge.adapters

import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.annotation.SuppressLint
import android.content.Context
import android.util.TypedValue
import android.view.GestureDetector
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.animation.OvershootInterpolator
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.enlace.bridge.R
import com.enlace.bridge.api.FeedApiClient
import com.enlace.bridge.models.ChatPreviewMessage
import com.enlace.bridge.models.UserPerson
import com.enlace.bridge.utils.ImageUtils
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class FeedAdapter(
    private var personas: List<UserPerson>,
    private val apiClient: FeedApiClient,
    private val scope: CoroutineScope,
    private val onOpenProfile: (String) -> Unit,
    private val onOpenReactionDialog: (UserPerson) -> Unit,
    private val onConnectFriend: (UserPerson) -> Unit,
    private val onMoreOptions: (UserPerson) -> Unit,
    private val onCall: (UserPerson, Boolean) -> Unit
) : RecyclerView.Adapter<FeedAdapter.FeedViewHolder>() {

    private val chatCache = mutableMapOf<String, List<ChatPreviewMessage>>()
    private val chatIndexMap = mutableMapOf<String, Int>()

    fun updatePersonas(newPersonas: List<UserPerson>) {
        this.personas = newPersonas
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): FeedViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_tarjeta_par_cuadrados, parent, false)
        return FeedViewHolder(view)
    }

    override fun getItemCount(): Int = personas.size

    @SuppressLint("ClickableViewAccessibility", "SetTextI18n")
    override fun onBindViewHolder(holder: FeedViewHolder, position: Int) {
        val p = personas[position]
        val context = holder.itemView.context

        // Reset Subviews
        setSubviewsState(holder, subIzq = 1, subDer = 1)

        // LEFT SQUARE - Subview 1 Data
        val avatarName = p.name ?: "Persona"
        ImageUtils.loadBase64OrPlaceholder(holder.ivPhotoFull, p.avatarData, avatarName)

        if (!p.statusText.isNullOrBlank() || !p.bio.isNullOrBlank()) {
            val statusStr = p.statusText ?: (if ((p.bio?.length ?: 0) > 20) p.bio?.substring(0, 20) + "…" else p.bio)
            holder.tvStatusBubble.text = statusStr
            holder.tvStatusBubble.visibility = View.VISIBLE
        } else {
            holder.tvStatusBubble.visibility = View.GONE
        }

        holder.vOnlineBadge.visibility = if (p.isOnline) View.VISIBLE else View.GONE

        // LEFT SQUARE - Subview 2 (Buttons)
        holder.btnReaccionarIzq.text = getEmojiForReaction(p.miReaccion)
        holder.btnConectarIzq.text = if (p.estadoAmistad == "amigos") "Amigos" else "Conectar"

        holder.btnPerfilIzq.setOnClickListener { onOpenProfile(p.id) }
        holder.btnReaccionarIzq.setOnClickListener { onOpenReactionDialog(p) }
        holder.btnConectarIzq.setOnClickListener { onConnectFriend(p) }
        holder.btnMasIzq.setOnClickListener { onMoreOptions(p) }

        // LEFT SQUARE - Subview 3 (Redes & Calls)
        val redesSummary = buildRedesSummary(p)
        holder.tvRedesSummary.text = redesSummary
        holder.btnAudioIzq.setOnClickListener { onCall(p, false) }
        holder.btnVideoIzq.setOnClickListener { onCall(p, true) }

        // RIGHT SQUARE - Subview 1
        val similitud = calculateSimilitud(p)
        holder.tvSimilitudBadge.text = "🎯 $similitud% similitud"

        val verifiedMark = if (p.verified) " ✔️" else ""
        holder.tvNameVerified.text = "${p.name ?: "Usuario"}$verifiedMark"

        val flag = p.flagEmoji ?: "🇨🇺"
        val city = p.city ?: "Cuba"
        holder.tvLocation.text = "$flag $city"

        if (!p.origen.isNullOrBlank()) {
            holder.tvOrigenTag.text = getOrigenLabel(p.origen)
            holder.tvOrigenTag.visibility = View.VISIBLE
        } else {
            holder.tvOrigenTag.visibility = View.GONE
        }

        holder.btnVerPerfilDer.setOnClickListener { onOpenProfile(p.id) }

        // DOTS CLICK LISTENERS
        holder.dotIzq1.setOnClickListener { setSubviewsState(holder, subIzq = 1, subDer = holder.currentSubDer) }
        holder.dotIzq2.setOnClickListener { setSubviewsState(holder, subIzq = 2, subDer = holder.currentSubDer) }
        holder.dotIzq3.setOnClickListener { setSubviewsState(holder, subIzq = 3, subDer = holder.currentSubDer) }

        holder.dotDer1.setOnClickListener { setSubviewsState(holder, subIzq = holder.currentSubIzq, subDer = 1) }
        holder.dotDer2.setOnClickListener {
            setSubviewsState(holder, subIzq = holder.currentSubIzq, subDer = 2)
            loadChatPreview(p, holder)
        }

        // SWIPE GESTURE DETECTOR (Left Square)
        setupSwipeListener(context, holder.cuadradoIzq) { isSwipeLeft ->
            val nextSub = if (isSwipeLeft) {
                if (holder.currentSubIzq >= 3) 1 else holder.currentSubIzq + 1
            } else {
                if (holder.currentSubIzq <= 1) 3 else holder.currentSubIzq - 1
            }
            setSubviewsState(holder, subIzq = nextSub, subDer = holder.currentSubDer)
        }

        // SWIPE GESTURE DETECTOR (Right Square)
        setupSwipeListener(context, holder.cuadradoDer) { isSwipeLeft ->
            val nextSub = if (isSwipeLeft) {
                if (holder.currentSubDer >= 2) 1 else holder.currentSubDer + 1
            } else {
                if (holder.currentSubDer <= 1) 2 else holder.currentSubDer - 1
            }
            setSubviewsState(holder, subIzq = holder.currentSubIzq, subDer = nextSub)
            if (nextSub == 2) loadChatPreview(p, holder)
        }

        // DOUBLE-TAP HEART ANIMATION ON PHOTO
        setupDoubleTapPhoto(context, holder.subvistaIzq1, holder) {
            onOpenReactionDialog(p)
        }

        // CHAT PREVIEW PAGINATION
        holder.btnChatPrev.setOnClickListener {
            val msgs = chatCache[p.id] ?: emptyList()
            if (msgs.isNotEmpty()) {
                val currIdx = chatIndexMap[p.id] ?: 0
                val nextIdx = (currIdx - 1 + msgs.size) % msgs.size
                chatIndexMap[p.id] = nextIdx
                renderChatPreview(holder, p.id)
            }
        }

        holder.btnChatNext.setOnClickListener {
            val msgs = chatCache[p.id] ?: emptyList()
            if (msgs.isNotEmpty()) {
                val currIdx = chatIndexMap[p.id] ?: 0
                val nextIdx = (currIdx + 1) % msgs.size
                chatIndexMap[p.id] = nextIdx
                renderChatPreview(holder, p.id)
            }
        }
    }

    private fun setSubviewsState(holder: FeedViewHolder, subIzq: Int, subDer: Int) {
        holder.currentSubIzq = subIzq
        holder.currentSubDer = subDer

        // Subviews Izq
        holder.subvistaIzq1.visibility = if (subIzq == 1) View.VISIBLE else View.GONE
        holder.subvistaIzq2.visibility = if (subIzq == 2) View.VISIBLE else View.GONE
        holder.subvistaIzq3.visibility = if (subIzq == 3) View.VISIBLE else View.GONE

        holder.dotIzq1.setBackgroundResource(if (subIzq == 1) R.drawable.bg_dot_active else R.drawable.bg_dot_inactive)
        holder.dotIzq2.setBackgroundResource(if (subIzq == 2) R.drawable.bg_dot_active else R.drawable.bg_dot_inactive)
        holder.dotIzq3.setBackgroundResource(if (subIzq == 3) R.drawable.bg_dot_active else R.drawable.bg_dot_inactive)

        // Subviews Der
        holder.subvistaDer1.visibility = if (subDer == 1) View.VISIBLE else View.GONE
        holder.subvistaDer2.visibility = if (subDer == 2) View.VISIBLE else View.GONE

        holder.dotDer1.setBackgroundResource(if (subDer == 1) R.drawable.bg_dot_active else R.drawable.bg_dot_inactive)
        holder.dotDer2.setBackgroundResource(if (subDer == 2) R.drawable.bg_dot_active else R.drawable.bg_dot_inactive)
    }

    private fun loadChatPreview(p: UserPerson, holder: FeedViewHolder) {
        if (chatCache.containsKey(p.id)) {
            renderChatPreview(holder, p.id)
            return
        }

        holder.tvChatPreviewText.text = "Cargando chat…"
        scope.launch {
            val res = apiClient.getChatMessages(p.id)
            withContext(Dispatchers.Main) {
                val msgs = res.getOrDefault(emptyList())
                chatCache[p.id] = msgs
                chatIndexMap[p.id] = 0
                renderChatPreview(holder, p.id)
            }
        }
    }

    @SuppressLint("SetTextI18n")
    private fun renderChatPreview(holder: FeedViewHolder, userId: String) {
        val msgs = chatCache[userId] ?: emptyList()
        val currIdx = chatIndexMap[userId] ?: 0

        if (msgs.isEmpty()) {
            holder.tvChatPreviewText.text = "Sin mensajes escritos aún.\n¡Toca para hablarle!"
            holder.tvChatPag.text = "0/0"
        } else {
            val validIdx = Math.min(Math.max(0, currIdx), msgs.size - 1)
            val msg = msgs[validIdx]
            holder.tvChatPreviewText.text = msg.text ?: "(Sin texto)"
            holder.tvChatPag.text = "${validIdx + 1}/${msgs.size}"
        }
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun setupSwipeListener(context: Context, view: View, onSwipe: (isLeft: Boolean) -> Unit) {
        val gestureDetector = GestureDetector(context, object : GestureDetector.SimpleOnGestureListener() {
            override fun onDown(e: MotionEvent): Boolean = true

            override fun onFling(
                e1: MotionEvent?,
                e2: MotionEvent,
                velocityX: Float,
                velocityY: Float
            ): Boolean {
                if (e1 == null) return false
                val diffX = e2.x - e1.x
                val diffY = e2.y - e1.y
                if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 80 && Math.abs(velocityX) > 100) {
                    onSwipe(diffX < 0) // diffX < 0 is swipe left
                    return true
                }
                return false
            }
        })

        view.setOnTouchListener { _, event -> gestureDetector.onTouchEvent(event) }
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun setupDoubleTapPhoto(
        context: Context,
        photoView: View,
        holder: FeedViewHolder,
        onDoubleTap: () -> Unit
    ) {
        val gestureDetector = GestureDetector(context, object : GestureDetector.SimpleOnGestureListener() {
            override fun onDown(e: MotionEvent): Boolean = true

            override fun onDoubleTap(e: MotionEvent): Boolean {
                animateHeart(holder.subvistaIzq1)
                onDoubleTap()
                return true
            }
        })

        photoView.setOnTouchListener { _, event -> gestureDetector.onTouchEvent(event) }
    }

    private fun animateHeart(container: FrameLayout) {
        val heartTv = TextView(container.context).apply {
            text = "💗"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 48f)
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = android.view.Gravity.CENTER
            }
        }
        container.addView(heartTv)

        val scaleX = ObjectAnimator.ofFloat(heartTv, View.SCALE_X, 0.2f, 1.4f, 1.0f)
        val scaleY = ObjectAnimator.ofFloat(heartTv, View.SCALE_Y, 0.2f, 1.4f, 1.0f)

        AnimatorSet().apply {
            playTogether(scaleX, scaleY)
            duration = 300
            interpolator = OvershootInterpolator()
            start()
        }

        heartTv.postDelayed({
            val fade = ObjectAnimator.ofFloat(heartTv, View.ALPHA, 1.0f, 0.0f).apply { duration = 250 }
            fade.start()
            heartTv.postDelayed({ container.removeView(heartTv) }, 260)
        }, 400)
    }

    private fun getEmojiForReaction(tipo: String?): String {
        return when (tipo) {
            "atrae" -> "😍"
            "cae_bien" -> "😊"
            "interesante" -> "🧠"
            "estilo" -> "🎨"
            "divertido" -> "😂"
            "quiero_hablarle" -> "💬"
            "buena_persona" -> "🤝"
            "desconfianza" -> "⚠️"
            "no_interesa" -> "👎"
            else -> "💗"
        }
    }

    private fun getOrigenLabel(origen: String?): String {
        return when (origen) {
            "local" -> "Tu localidad"
            "afinidad_otra_localidad" -> "Afinidad de localidad"
            "exploracion_aleatoria" -> "Descubrimiento al azar"
            "cuenta_nueva" -> "Cuenta nueva"
            else -> ""
        }
    }

    private fun calculateSimilitud(p: UserPerson): Int {
        val listSize = (p.interests?.size ?: 0) + (p.hobbies?.size ?: 0)
        return Math.min(99, Math.max(65, 70 + (listSize * 4) % 28))
    }

    private fun buildRedesSummary(p: UserPerson): String {
        val list = mutableListOf<String>()
        if (!p.phone.isNullOrBlank()) list.add("WhatsApp")
        if (!p.instagram.isNullOrBlank() || !p.socialLinks?.instagram.isNullOrBlank()) list.add("Instagram")
        if (!p.socialLinks?.telegram.isNullOrBlank()) list.add("Telegram")
        if (!p.socialLinks?.discord.isNullOrBlank()) list.add("Discord")
        if (!p.socialLinks?.freefire.isNullOrBlank()) list.add("Free Fire")

        return if (list.isNotEmpty()) "Redes: " + list.joinToString(", ") else "Sin redes configuradas aún."
    }

    class FeedViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        var currentSubIzq = 1
        var currentSubDer = 1

        val cuadradoIzq: FrameLayout = itemView.findViewById(R.id.cuadradoIzq)
        val cuadradoDer: FrameLayout = itemView.findViewById(R.id.cuadradoDer)

        val dotIzq1: View = itemView.findViewById(R.id.dotIzq1)
        val dotIzq2: View = itemView.findViewById(R.id.dotIzq2)
        val dotIzq3: View = itemView.findViewById(R.id.dotIzq3)

        val subvistaIzq1: FrameLayout = itemView.findViewById(R.id.subvistaIzq1)
        val subvistaIzq2: LinearLayout = itemView.findViewById(R.id.subvistaIzq2)
        val subvistaIzq3: LinearLayout = itemView.findViewById(R.id.subvistaIzq3)

        val ivPhotoFull: ImageView = itemView.findViewById(R.id.ivPhotoFull)
        val tvStatusBubble: TextView = itemView.findViewById(R.id.tvStatusBubble)
        val vOnlineBadge: View = itemView.findViewById(R.id.vOnlineBadge)

        val btnPerfilIzq: Button = itemView.findViewById(R.id.btnPerfilIzq)
        val btnReaccionarIzq: Button = itemView.findViewById(R.id.btnReaccionarIzq)
        val btnConectarIzq: Button = itemView.findViewById(R.id.btnConectarIzq)
        val btnMasIzq: Button = itemView.findViewById(R.id.btnMasIzq)

        val tvRedesSummary: TextView = itemView.findViewById(R.id.tvRedesSummary)
        val btnAudioIzq: Button = itemView.findViewById(R.id.btnAudioIzq)
        val btnVideoIzq: Button = itemView.findViewById(R.id.btnVideoIzq)

        val dotDer1: View = itemView.findViewById(R.id.dotDer1)
        val dotDer2: View = itemView.findViewById(R.id.dotDer2)

        val subvistaDer1: LinearLayout = itemView.findViewById(R.id.subvistaDer1)
        val subvistaDer2: LinearLayout = itemView.findViewById(R.id.subvistaDer2)

        val tvSimilitudBadge: TextView = itemView.findViewById(R.id.tvSimilitudBadge)
        val tvNameVerified: TextView = itemView.findViewById(R.id.tvNameVerified)
        val tvLocation: TextView = itemView.findViewById(R.id.tvLocation)
        val tvOrigenTag: TextView = itemView.findViewById(R.id.tvOrigenTag)
        val btnVerPerfilDer: Button = itemView.findViewById(R.id.btnVerPerfilDer)

        val tvChatPreviewText: TextView = itemView.findViewById(R.id.tvChatPreviewText)
        val btnChatPrev: TextView = itemView.findViewById(R.id.btnChatPrev)
        val tvChatPag: TextView = itemView.findViewById(R.id.tvChatPag)
        val btnChatNext: TextView = itemView.findViewById(R.id.btnChatNext)
    }
}
