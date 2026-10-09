package com.enlace.bridge.utils

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.Rect
import android.util.Base64
import android.widget.ImageView

object ImageUtils {

    fun loadBase64OrPlaceholder(imageView: ImageView, base64Data: String?, placeholderText: String = "U") {
        if (base64Data.isNullOrBlank()) {
            imageView.setImageBitmap(createInitialsBitmap(placeholderText))
            return
        }

        try {
            val cleanData = if (base64Data.contains(",")) {
                base64Data.substringAfter(",")
            } else {
                base64Data
            }
            val bytes = Base64.decode(cleanData, Base64.DEFAULT)
            val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            if (bitmap != null) {
                imageView.setImageBitmap(bitmap)
            } else {
                imageView.setImageBitmap(createInitialsBitmap(placeholderText))
            }
        } catch (e: Exception) {
            imageView.setImageBitmap(createInitialsBitmap(placeholderText))
        }
    }

    fun getCircularBitmap(bitmap: Bitmap): Bitmap {
        val size = Math.min(bitmap.width, bitmap.height)
        val output = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(output)

        val color = -0xb33334
        val paint = Paint()
        val rect = Rect(0, 0, size, size)

        paint.isAntiAlias = true
        canvas.drawARGB(0, 0, 0, 0)
        paint.color = color
        canvas.drawCircle(size / 2f, size / 2f, size / 2f, paint)
        paint.xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_IN)
        canvas.drawBitmap(bitmap, rect, rect, paint)

        return output
    }

    private fun createInitialsBitmap(text: String): Bitmap {
        val initial = if (text.isNotBlank()) text.trim().substring(0, 1).uppercase() else "U"
        val bitmap = Bitmap.createBitmap(120, 120, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        val paintBg = Paint().apply {
            color = 0xFF5B21B6.toInt() // Purple accent
            isAntiAlias = true
        }
        canvas.drawCircle(60f, 60f, 60f, paintBg)

        val paintText = Paint().apply {
            color = 0xFFFFFFFF.toInt()
            textSize = 50f
            isAntiAlias = true
            textAlign = Paint.Align.CENTER
        }
        val yPos = (canvas.height / 2f - (paintText.descent() + paintText.ascent()) / 2f)
        canvas.drawText(initial, 60f, yPos, paintText)

        return bitmap
    }
}
