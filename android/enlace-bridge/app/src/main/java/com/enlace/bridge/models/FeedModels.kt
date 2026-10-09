package com.enlace.bridge.models

import com.google.gson.annotations.SerializedName

data class UserSocialLinks(
    val telegram: String? = null,
    val instagram: String? = null,
    val discord: String? = null,
    val freefire: String? = null,
    val clashofclans: String? = null,
    val callofduty: String? = null,
    val otros: String? = null
)

data class UserPerson(
    val id: String,
    val name: String? = null,
    val username: String? = null,
    @SerializedName("avatar_data") val avatarData: String? = null,
    @SerializedName("cover_data") val coverData: String? = null,
    val city: String? = null,
    val state: String? = null,
    val country: String? = null,
    @SerializedName("flag_emoji") val flagEmoji: String? = null,
    val profession: String? = null,
    val gender: String? = null,
    val bio: String? = null,
    @SerializedName("status_text") val statusText: String? = null,
    val verified: Boolean = false,
    @SerializedName("is_online") val isOnline: Boolean = false,
    @SerializedName("estado_amistad") val estadoAmistad: String? = "ninguno",
    @SerializedName("solicitud_de_mi") val solicitudDeMi: Boolean = false,
    val origen: String? = null,
    @SerializedName("mi_reaccion") var miReaccion: String? = null,
    val phone: String? = null,
    @SerializedName("country_code") val countryCode: String? = null,
    val instagram: String? = null,
    @SerializedName("social_links") val socialLinks: UserSocialLinks? = null,
    val interests: List<String>? = emptyList(),
    val hobbies: List<String>? = emptyList()
)

data class UserStory(
    val id: String,
    @SerializedName("user_id") val userId: String,
    @SerializedName("autor_nombre") val autorNombre: String? = null,
    @SerializedName("autor_avatar") val autorAvatar: String? = null,
    val text: String? = null,
    @SerializedName("image_data") val imageData: String? = null,
    @SerializedName("created_at") val createdAt: String? = null
)

data class ChatPreviewMessage(
    val id: String? = null,
    val senderId: String? = null,
    val receiverId: String? = null,
    val text: String? = null,
    @SerializedName("media_url") val mediaUrl: String? = null,
    @SerializedName("created_at") val createdAt: String? = null
)

data class FeedResponse(
    val personas: List<UserPerson> = emptyList()
)

data class StoriesResponse(
    val estados: List<UserStory> = emptyList()
)

data class MessagesResponse(
    val mensajes: List<ChatPreviewMessage> = emptyList()
)

data class ReactionResponse(
    val ok: Boolean = false,
    val reaccion: ReactionDetail? = null
)

data class ReactionDetail(
    val tipo: String? = null,
    @SerializedName("actualizada_en") val actualizadaEn: String? = null
)
