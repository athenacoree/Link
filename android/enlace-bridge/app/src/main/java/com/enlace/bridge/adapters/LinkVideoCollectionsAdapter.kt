package com.enlace.bridge.adapters

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.enlace.bridge.R
import com.enlace.bridge.models.LinkVideoCollectionItem
import com.enlace.bridge.utils.ImageUtils

class LinkVideoCollectionsAdapter(
    private var collections: List<LinkVideoCollectionItem>,
    private val onCollectionClick: (LinkVideoCollectionItem) -> Unit
) : RecyclerView.Adapter<LinkVideoCollectionsAdapter.CollectionViewHolder>() {

    fun updateCollections(newList: List<LinkVideoCollectionItem>) {
        this.collections = newList
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): CollectionViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_coleccion_video, parent, false)
        return CollectionViewHolder(view)
    }

    override fun getItemCount(): Int = collections.size

    override fun onBindViewHolder(holder: CollectionViewHolder, position: Int) {
        val item = collections[position]
        holder.tvTitle.text = item.title
        holder.tvCategory.text = item.category ?: "General"
        holder.tvCount.text = "🎬 ${item.videoCount} videos"

        ImageUtils.loadBase64OrPlaceholder(holder.ivCover, item.coverUrl, item.title)

        holder.itemView.setOnClickListener { onCollectionClick(item) }
    }

    class CollectionViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val ivCover: ImageView = itemView.findViewById(R.id.ivColCover)
        val tvCount: TextView = itemView.findViewById(R.id.tvColVideoCount)
        val tvTitle: TextView = itemView.findViewById(R.id.tvColTitle)
        val tvCategory: TextView = itemView.findViewById(R.id.tvColCategory)
    }
}
