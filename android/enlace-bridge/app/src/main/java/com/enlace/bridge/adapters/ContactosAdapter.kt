package com.enlace.bridge.adapters

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.enlace.bridge.R
import com.enlace.bridge.models.UserPerson
import com.enlace.bridge.utils.ImageUtils

class ContactosAdapter(
    private var contactos: List<UserPerson>,
    private val onMensajeClick: (UserPerson) -> Unit,
    private val onLlamarClick: (UserPerson) -> Unit,
    private val onAceptarClick: ((UserPerson) -> Unit)? = null,
    private val isSolicitudesMode: Boolean = false
) : RecyclerView.Adapter<ContactosAdapter.ContactoViewHolder>() {

    fun updateContactos(newList: List<UserPerson>) {
        this.contactos = newList
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ContactoViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_contacto, parent, false)
        return ContactoViewHolder(view)
    }

    override fun getItemCount(): Int = contactos.size

    override fun onBindViewHolder(holder: ContactoViewHolder, position: Int) {
        val user = contactos[position]
        val name = user.name ?: "Contacto"
        holder.tvNombre.text = name

        val cityStr = user.city ?: "Cuba"
        val flagStr = user.flagEmoji ?: "🇨🇺"
        holder.tvDetalle.text = "$flagStr $cityStr"

        ImageUtils.loadBase64OrPlaceholder(holder.ivAvatar, user.avatarData, name)
        holder.vOnline.visibility = if (user.isOnline) View.VISIBLE else View.GONE

        if (isSolicitudesMode) {
            holder.btnAccion1.text = "Aceptar"
            holder.btnAccion2.text = "Rechazar"

            holder.btnAccion1.setOnClickListener { onAceptarClick?.invoke(user) }
            holder.btnAccion2.setOnClickListener { onLlamarClick(user) }
        } else {
            holder.btnAccion1.text = "Mensaje"
            holder.btnAccion2.text = "Llamar"

            holder.btnAccion1.setOnClickListener { onMensajeClick(user) }
            holder.btnAccion2.setOnClickListener { onLlamarClick(user) }
        }
    }

    class ContactoViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val ivAvatar: ImageView = itemView.findViewById(R.id.ivContactoAvatar)
        val vOnline: View = itemView.findViewById(R.id.vContactoOnline)
        val tvNombre: TextView = itemView.findViewById(R.id.tvContactoNombre)
        val tvDetalle: TextView = itemView.findViewById(R.id.tvContactoDetalle)
        val btnAccion1: Button = itemView.findViewById(R.id.btnContactoAccion1)
        val btnAccion2: Button = itemView.findViewById(R.id.btnContactoAccion2)
    }
}
