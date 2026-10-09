package com.enlace.bridge.adapters

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.enlace.bridge.R
import com.enlace.bridge.models.UserStory
import com.enlace.bridge.utils.ImageUtils

class StoriesAdapter(
    private var stories: List<UserStory>,
    private val onStoryClick: (UserStory?) -> Unit
) : RecyclerView.Adapter<StoriesAdapter.StoryViewHolder>() {

    fun updateStories(newStories: List<UserStory>) {
        this.stories = newStories
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): StoryViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_estado_historia, parent, false)
        return StoryViewHolder(view)
    }

    override fun getItemCount(): Int {
        // Always at least 1 item for "Tu estado"
        return if (stories.isEmpty()) 1 else stories.size + 1
    }

    override fun onBindViewHolder(holder: StoryViewHolder, position: Int) {
        if (position == 0) {
            // Item 0: Tu estado
            holder.tvStoryName.text = "Tu estado"
            holder.tvPlusBadge.visibility = View.VISIBLE
            ImageUtils.loadBase64OrPlaceholder(holder.ivStoryAvatar, null, "Yo")
            holder.itemView.setOnClickListener { onStoryClick(null) }
        } else {
            val story = stories[position - 1]
            val firstName = story.autorNombre?.split(" ")?.firstOrNull() ?: "Usuario"
            holder.tvStoryName.text = firstName
            holder.tvPlusBadge.visibility = View.GONE
            ImageUtils.loadBase64OrPlaceholder(holder.ivStoryAvatar, story.autorAvatar, firstName)
            holder.itemView.setOnClickListener { onStoryClick(story) }
        }
    }

    class StoryViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val ivStoryAvatar: ImageView = itemView.findViewById(R.id.ivStoryAvatar)
        val tvPlusBadge: TextView = itemView.findViewById(R.id.tvPlusBadge)
        val tvStoryName: TextView = itemView.findViewById(R.id.tvStoryName)
    }
}
