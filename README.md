# Project X Script API

The public API for writing scripts against the Project X engine.

Scripts can be written in **Kotlin or Java**. The engine itself is closed
source. This repository publishes the compiled API it exposes to scripts, so you
can build scripts without the engine source.

## What is published

Each release carries two jars:

| Jar | What it is |
|---|---|
| `projectx-engine-api` | The script API: script types, the action and event API, game entities, the overlay DSL |
| `projectx-core` | Shared types scripts use, including tiles, coordinates and the cache library |

They are attached to each [release](https://github.com/iEasyScript/script-api/releases).
You do not need to download them by hand: point Gradle at the releases and it
fetches them like any other dependency.

## Using it

```kotlin
repositories {
    mavenCentral()
    exclusiveContent {
        forRepository {
            ivy {
                url = uri("https://github.com/iEasyScript/script-api/releases/download")
                patternLayout { artifact("v[revision]/[artifact]-[revision].[ext]") }
                metadataSources { artifact() }
            }
        }
        filter { includeGroup("com.projectx") }
    }
}

dependencies {
    compileOnly("com.projectx:projectx-engine-api:1.6.1")
    compileOnly("com.projectx:projectx-core:1.6.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.11.0")
}
```

`compileOnly` is deliberate. The engine already has these classes loaded, so
bundling them into your script jar would shadow the running engine.

Build with JDK 25 and Kotlin 2.4.0 to match the engine, and edit in IntelliJ IDEA 2026.1 or newer: older IDEs cannot read Kotlin 2.4 classes and show every API import as unresolved. Java scripts extend
`JavaScript` rather than `Script`; the guide explains why.

The engine loads script jars from `~/.projectx/scripts/`.

## Where to start

Read [WRITING-SCRIPTS.md](WRITING-SCRIPTS.md) for the full guide, from an empty
folder to a script running in the client.

[script-template](https://github.com/iEasyScript/script-template) is a working
project wired up exactly this way, with an example script in each language. Clone
it, open it in IntelliJ, and you have a build that compiles.

[community-scripts](https://github.com/iEasyScript/community-scripts) is the
shared collection, if you would rather contribute than publish your own.

## Versioning

The API tracks the engine build. A script compiled against one release is not
guaranteed to load against a different one, so rebuild when the engine updates.
