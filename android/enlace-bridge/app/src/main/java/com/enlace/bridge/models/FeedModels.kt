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
    @SerializedName("sender_id") val senderId: String? = null,
    @SerializedName("receiver_id") val receiverId: String? = null,
    val text: String? = null,
    @SerializedName("media_url") val mediaUrl: String? = null,
    @SerializedName("created_at") val createdAt: String? = null
)

data class ConversacionItem(
    val id: String? = null,
    val otroUsuario: UserPerson? = null,
    val ultimoMensaje: String? = null,
    val fecha: String? = null,
    val noLeidos: Int = 0
)

data class LinkVideoCollectionItem(
    val id: String,
    val title: String,
    val category: String? = "General",
    @SerializedName("audio_description") val audioDescription: String? = null,
    @SerializedName("cover_url") val coverUrl: String? = null,
    @SerializedName("video_count") val videoCount: Int = 0
)

data class LinkVideoItem(
    val id: String,
    @SerializedName("collection_id") val collectionId: String? = null,
    val title: String? = null,
    @SerializedName("youtube_url") val youtubeUrl: String? = null,
    @SerializedName("audio_description") val audioDescription: String? = null,
    @SerializedName("thumbnail_url") val thumbnailUrl: String? = null
)

data class PublicacionItem(
    val id: String,
    @SerializedName("user_id") val userId: String? = null,
    val text: String? = null,
    @SerializedName("image_data") val imageData: String? = null,
    val visibility: String? = "public",
    val likesCount: Int = 0,
    val commentsCount: Int = 0,
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

data class AmigosResponse(
    val amigos: List<UserPerson> = emptyList()
)

data class SolicitudesResponse(
    val solicitudes: List<UserPerson> = emptyList()
)

data class ConversacionesResponse(
    val conversaciones: List<ConversacionItem> = emptyList()
)

data class LinkVideoCollectionsResponse(
    val collections: List<LinkVideoCollectionItem> = emptyList()
)

data class LinkVideoDetailResponse(
    val collection: LinkVideoCollectionItem? = null,
    val videos: List<LinkVideoItem> = emptyList()
)

data class PublicacionesResponse(
    val publicaciones: List<PublicacionItem> = emptyList()
)

data class ReactionResponse(
    val ok: Boolean = false,
    val reaccion: ReactionDetail? = null
)

data class ReactionDetail(
    val tipo: String? = null,
    @SerializedName("actualizada_en") val actualizadaEn: String? = null
)
