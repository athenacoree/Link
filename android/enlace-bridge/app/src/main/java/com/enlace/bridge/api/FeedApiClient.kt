package com.enlace.bridge.api

import android.webkit.CookieManager
import com.enlace.bridge.auth.DeviceIdentityManager
import com.enlace.bridge.models.*
import com.google.gson.Gson
import com.google.gson.JsonObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

class FeedApiClient(private val identityManager: DeviceIdentityManager) {

    private val gson = Gson()
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    private fun buildRequest(url: String, method: String = "GET", bodyJson: String? = null): Request {
        val serverUrl = identityManager.getServerUrl().trimEnd('/')
        val cookieHeader = CookieManager.getInstance().getCookie(serverUrl) ?: ""

        val builder = Request.Builder()
            .url(url)
            .header("User-Agent", "LinkApp/1.0 (Android Native Feed)")

        if (cookieHeader.isNotBlank()) {
            builder.header("Cookie", cookieHeader)
        }

        when (method.uppercase()) {
            "POST" -> builder.post((bodyJson ?: "{}").toRequestBody(jsonMediaType))
            "PUT" -> builder.put((bodyJson ?: "{}").toRequestBody(jsonMediaType))
            "DELETE" -> builder.delete()
            else -> builder.get()
        }

        return builder.build()
    }

    suspend fun getFeedUsers(): Result<List<UserPerson>> {
        return withContext(Dispatchers.IO) {
            try {
                val serverUrl = identityManager.getServerUrl().trimEnd('/')
                val url = "$serverUrl/api/usuarios"
                val request = buildRequest(url)

                client.newCall(request).execute().use { response ->
                    val bodyStr = response.body?.string() ?: ""
                    if (response.isSuccessful) {
                        val parsed = gson.fromJson(bodyStr, FeedResponse::class.java)
                        Result.success(parsed.personas)
                    } else {
                        Result.failure(Exception("Error ${response.code} al cargar feed de personas"))
                    }
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }

    suspend fun searchUsers(query: String): Result<List<UserPerson>> {
        return withContext(Dispatchers.IO) {
            try {
                val serverUrl = identityManager.getServerUrl().trimEnd('/')
                val encodedQ = URLEncoder.encode(query, "UTF-8")
                val url = "$serverUrl/api/usuarios/buscar?q=$encodedQ"
                val request = buildRequest(url)

                client.newCall(request).execute().use { response ->
                    val bodyStr = response.body?.string() ?: ""
                    if (response.isSuccessful) {
                        val parsed = gson.fromJson(bodyStr, FeedResponse::class.java)
                        Result.success(parsed.personas)
                    } else {
                        Result.failure(Exception("Error ${response.code} en búsqueda"))
                    }
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }

    suspend fun getStories(): Result<List<UserStory>> {
        return withContext(Dispatchers.IO) {
            try {
                val serverUrl = identityManager.getServerUrl().trimEnd('/')
                val url = "$serverUrl/api/estados"
                val request = buildRequest(url)

                client.newCall(request).execute().use { response ->
                    val bodyStr = response.body?.string() ?: ""
                    if (response.isSuccessful) {
                        val parsed = gson.fromJson(bodyStr, StoriesResponse::class.java)
                        Result.success(parsed.estados)
                    } else {
                        Result.failure(Exception("Error ${response.code} al cargar historias"))
                    }
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }

    suspend fun getChatMessages(targetUserId: String): Result<List<ChatPreviewMessage>> {
        return withContext(Dispatchers.IO) {
            try {
                val serverUrl = identityManager.getServerUrl().trimEnd('/')
                val url = "$serverUrl/api/mensajes/$targetUserId"
                val request = buildRequest(url)

                client.newCall(request).execute().use { response ->
                    val bodyStr = response.body?.string() ?: ""
                    if (response.isSuccessful) {
                        val parsed = gson.fromJson(bodyStr, MessagesResponse::class.java)
                        Result.success(parsed.mensajes)
                    } else {
                        Result.failure(Exception("Error ${response.code} al cargar chat"))
                    }
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }

    suspend fun postReaction(targetUserId: String, tipo: String): Result<String> {
        return withContext(Dispatchers.IO) {
            try {
                val serverUrl = identityManager.getServerUrl().trimEnd('/')
                val url = "$serverUrl/api/usuarios/$targetUserId/reaccion"
                val bodyJson = JsonObject().apply { addProperty("tipo", tipo) }.toString()
                val request = buildRequest(url, method = "PUT", bodyJson = bodyJson)

                client.newCall(request).execute().use { response ->
                    val bodyStr = response.body?.string() ?: ""
                    if (response.isSuccessful) {
                        val parsed = gson.fromJson(bodyStr, ReactionResponse::class.java)
                        val resultTipo = parsed.reaccion?.tipo ?: tipo
                        Result.success(resultTipo)
                    } else {
                        Result.failure(Exception("Error ${response.code} al guardar reacción"))
                    }
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }
}
