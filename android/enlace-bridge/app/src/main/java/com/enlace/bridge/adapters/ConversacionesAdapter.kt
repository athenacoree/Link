package com.enlace.bridge.adapters

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.enlace.bridge.R
import com.enlace.bridge.models.ConversacionItem
import com.enlace.bridge.utils.ImageUtils

class ConversacionesAdapter(
    private var conversaciones: List<ConversacionItem>,
    private val onConversacionClick: (ConversacionItem) -> Unit
) : RecyclerView.Adapter<ConversacionesAdapter.ConversacionViewHolder>() {

    fun updateConversaciones(newList: List<ConversacionItem>) {
        this.conversaciones = newList
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ConversacionViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_conversacion, parent, false)
        return ConversacionViewHolder(view)
    }

    override fun getItemCount(): Int = conversaciones.size

    override fun onBindViewHolder(holder: ConversacionViewHolder, position: Int) {
        val item = conversaciones[position]
        val user = item.otroUsuario
        val name = user?.name ?: "Usuario"

        holder.tvNombre.text = name
        holder.tvFecha.text = item.fecha ?: ""
        holder.tvUltimoMsg.text = item.ultimoMensaje ?: "Toca para conversar..."

        ImageUtils.loadBase64OrPlaceholder(holder.ivAvatar, user?.avatarData, name)
        holder.vOnline.visibility = if (user?.isOnline == true) View.VISIBLE else View.GONE

        if (item.noLeidos > 0) {
            holder.tvBadge.text = item.noLeidos.toString()
            holder.tvBadge.visibility = View.VISIBLE
        } else {
            holder.tvBadge.visibility = View.GONE
        }

        holder.itemView.setOnClickListener { onConversacionClick(item) }
    }

    class ConversacionViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val ivAvatar: ImageView = itemView.findViewById(R.id.ivConvAvatar)
        val vOnline: View = itemView.findViewById(R.id.vConvOnline)
        val tvNombre: TextView = itemView.findViewById(R.id.tvConvNombre)
        val tvFecha: TextView = itemView.findViewById(R.id.tvConvFecha)
        val tvUltimoMsg: TextView = itemView.findViewById(R.id.tvConvUltimoMsg)
        val tvBadge: TextView = itemView.findViewById(R.id.tvConvBadge)
    }
}
