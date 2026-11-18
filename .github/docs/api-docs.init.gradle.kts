// Puts Dokka on the root classpath beside the Kotlin plugin, which it must share a classloader with,
// then documents the engine module without the engine build having to know about it.
val docsDir = File(System.getenv("API_DOCS_DIR") ?: error("set API_DOCS_DIR"))

gradle.rootProject {
    buildscript {
        repositories { gradlePluginPortal() }
        dependencies { classpath("org.jetbrains.dokka:dokka-gradle-plugin:2.3.0") }
    }
}

gradle.afterProject {
    if (path == ":client-plugin-engine") apply(from = docsDir.resolve("api-docs.gradle"))
}
