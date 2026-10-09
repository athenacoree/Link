package com.enlace.bridge.adapters

import android.graphics.Color
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.enlace.bridge.R
import com.enlace.bridge.models.ChatPreviewMessage

class ChatMensajesAdapter(
    private var mensajes: List<ChatPreviewMessage>,
    private val currentUserId: String
) : RecyclerView.Adapter<ChatMensajesAdapter.ChatMessageViewHolder>() {

    fun updateMensajes(newList: List<ChatPreviewMessage>) {
        this.mensajes = newList
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ChatMessageViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_chat_mensaje, parent, false)
        return ChatMessageViewHolder(view)
    }

    override fun getItemCount(): Int = mensajes.size

    override fun onBindViewHolder(holder: ChatMessageViewHolder, position: Int) {
        val msg = mensajes[position]
        val isMine = msg.senderId == currentUserId

        holder.tvText.text = msg.text ?: ""
        holder.tvTime.text = msg.createdAt?.takeLast(8)?.take(5) ?: ""

        if (isMine) {
            holder.llContainer.gravity = Gravity.END
            holder.llBubble.setBackgroundResource(R.drawable.bg_btn_primary)
            holder.tvText.setTextColor(Color.WHITE)
            holder.tvTime.setTextColor(Color.parseColor("#E0E7FF"))
        } else {
            holder.llContainer.gravity = Gravity.START
            holder.llBubble.setBackgroundResource(R.drawable.bg_card_cuadrado)
            holder.tvText.setTextColor(Color.parseColor("#1F2937"))
            holder.tvTime.setTextColor(Color.parseColor("#9CA3AF"))
        }
    }

    class ChatMessageViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val llContainer: LinearLayout = itemView.findViewById(R.id.llChatMessageContainer)
        val llBubble: LinearLayout = itemView.findViewById(R.id.llChatBubble)
        val tvText: TextView = itemView.findViewById(R.id.tvChatMsgText)
        val tvTime: TextView = itemView.findViewById(R.id.tvChatMsgTime)
    }
}
