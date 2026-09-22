pluginManagement {
    repositories {
        google()
        maven { url = java.net.URI.create("https://maven.aliyun.com/repository/public") }
        maven { url = java.net.URI.create("https://repo1.maven.org/maven2/") }
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        maven { url = java.net.URI.create("https://maven.aliyun.com/repository/public") }
        maven { url = java.net.URI.create("https://repo1.maven.org/maven2/") }
        mavenCentral()
    }
}

rootProject.name = "enlace-bridge"
include(":app")
