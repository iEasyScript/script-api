# Project X Script API

The public API for writing scripts against the Project X engine.

Scripts can be written in **Kotlin or Java**, and the whole API works from both.
The engine itself is closed source. This repository publishes the compiled API it
exposes to scripts, so you can build scripts without the engine source.

## What is published

Each release carries two jars:

| Jar | What it is |
|---|---|
| `projectx-engine-api` | The script API: script types, the action and event API, game entities, the overlay DSL and Compose panels |
| `projectx-core` | Shared types scripts use, including tiles, coordinates and the cache library |

They are attached to each [release](https://github.com/iEasyScript/script-api/releases).
You do not need to download them by hand: point Gradle at the releases and it
fetches them like any other dependency.

## Using it

```kotlin
repositories {
    mavenCentral { content { excludeGroup("com.projectx") } }
    ivy {
        url = uri("https://github.com/iEasyScript/script-api/releases/download")
        patternLayout {
            ivy("v[revision]/ivy-[module]-[revision].xml")
            artifact("v[revision]/[artifact]-[revision](-[classifier]).[ext]")
        }
        metadataSources {
            ivyDescriptor()
            artifact()
        }
        content { includeGroup("com.projectx") }
    }
}

dependencies {
    compileOnly("com.projectx:projectx-engine-api:1.16.0")
    compileOnly("com.projectx:projectx-core:1.16.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.11.0")
}
```

`compileOnly` is deliberate. The engine already has these classes loaded, so
bundling them into your script jar would shadow the running engine.

The `ivy(...)` line is what gets you the API's source. Every release ships a
`-sources` jar beside each jar, and that descriptor is how Gradle finds it:
ctrl+click a call in your script and the IDE opens the API's own Kotlin,
comments and all, instead of decompiled bytecode. On an existing project,
reload Gradle once after switching - the old resolution is cached.

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

[SHARING-SCRIPTS.md](SHARING-SCRIPTS.md) explains handing out or selling your
script as a jar: how people install it, how to build one that works on their PC,
and what to know before you charge for it.

## Versioning

The API tracks the engine build. A script compiled against one release is not
guaranteed to load against a different one, so rebuild when the engine updates.

## Licence

The binaries released from this repository are built from the Project X engine, which derives from
[project-undercut/engine](https://gitlab.com/project-undercut/engine) and is licensed under the
**GNU General Public License, version 3**. The full text is in [`LICENSE`](LICENSE).

**Corresponding Source** for every binary released here:

| Part | Source |
|---|---|
| engine jar, supervisor, native bootstrap, launcher | <https://github.com/iEasyScript/engine> |
| the `re-resources` data the engine builds against | <https://github.com/iEasyScript/reclass-data> |

Both are public and free to obtain from the same place as the downloads, which is how GPLv3 §6(d) asks
for it. Release tags match the engine's, so the source for any given build is the source at that tag.
