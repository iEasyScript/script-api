# Writing Project X scripts

Scripts can be written in **Kotlin or Java**. This guide covers both, from an
empty folder to a script running in the client. Everything compiles against the
published API — no engine source needed.

If you are choosing: Kotlin gives you the API directly and reads more cleanly.
Java is fully supported through a small base class that keeps it safe. The two
can live in the same project and the same jar.

## 1. Set up a project

Clone the [starter template](https://github.com/iEasyScript/script-template),
which has one working script in each language, and open it in IntelliJ IDEA. The
build downloads the API and, if needed, JDK 25 itself. Or build the same structure
yourself:

**Use IntelliJ IDEA 2026.1 or newer.** The API is built with Kotlin 2.4, and older
IDEs cannot read its classes: every `com.projectx` import shows as
`Cannot resolve symbol` even though `./gradlew build` succeeds. Update through
the JetBrains Toolbox or Help → Check for Updates.

```
my-scripts/
├── build.gradle.kts
├── settings.gradle.kts
├── gradle.properties      <- projectxApiVersion=1.1.0
├── src/main/kotlin/...    <- Kotlin scripts
└── src/main/java/...      <- Java scripts
```

The build file needs Kotlin 2.4.0 and JVM toolchain 25 to match the engine, the
`java` plugin if you want Java scripts, the API as `compileOnly`, and coroutines.
The API is served from the script-api GitHub releases, so it needs its own
repository entry:

```kotlin
plugins {
    java
    kotlin("jvm") version "2.4.0"
}

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
    val projectxApi = providers.gradleProperty("projectxApiVersion").get()
    compileOnly("com.projectx:projectx-engine-api:$projectxApi")
    compileOnly("com.projectx:projectx-core:$projectxApi")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.11.0")
}
```

`compileOnly` matters. The engine already has these classes loaded, so bundling
them into your jar would shadow the running engine and break in confusing ways.

## 2. Write a script

Both languages use the same `@ScriptDescription` annotation. That annotation is
how the engine discovers your script, so it is not optional.

### Kotlin

Extend `Script` and implement `loop()`, which is a suspend function:

```kotlin
@ScriptDescription(
    name = "Example Woodcutter",
    version = "1.0.0",
    author = "Your Name",
    description = "Chops trees and drops the logs.",
)
class ExampleWoodcutter : Script() {

    override suspend fun loop() {
        if (interactClosestObject("Tree", "Chop down")) {
            waitForXPDrop()
            delay(240, 90)
        } else {
            delay(320, 200)
        }
    }
}
```

### Java

Extend `JavaScript` and implement `onLoop()`, which returns a `Wait`:

```java
@ScriptDescription(
    name = "Example Java Woodcutter",
    version = "1.0.0",
    author = "Your Name",
    description = "Chops trees and drops the logs."
)
public class ExampleJavaWoodcutter extends JavaScript {

    @Override
    public Wait onLoop() {
        if (interactClosestObject("Tree", "Chop down", 20)) {
            return Wait.xpDrop();
        }
        return Wait.ms(320, 200);
    }
}
```

Import the API as static methods: `import static com.projectx.script.api.APIKt.*;`

`onStart()`, `onStop()`, `onEvent()` and `render()` are optional overrides in
both languages.

### Why Java returns a Wait instead of waiting

Script bodies run on the client's main-logic tick, on the game thread. So a
script must never block — a `Thread.sleep` would freeze the client.

Kotlin handles this with suspend functions. Java cannot: the Kotlin `loop()`
receives a continuation that Java has no way to honour. The trap is that calling
a suspend helper from Java **compiles cleanly with no warning**, then silently
fails to wait. You get a loop spinning at tick rate, clicking dozens of times a
second — useless, and the most obvious thing a script can do.

So `onLoop()` returns the wait it wants and the engine performs it properly.
`loop()` is final in `JavaScript`, so you cannot reach the unsafe path by
accident.

## 3. The one habit that matters

**React to outcomes. Never sleep a fixed amount and hope.**

Both examples wait on an experience drop, which returns when the game actually
granted experience. A fixed three-second delay would be wrong twice over: too
short and you act before the action finished, too long and you idle obviously.

Every wait takes a timeout, so a missed interaction cannot hang the script.

| Kotlin | Java | Waits until |
|---|---|---|
| `delayUntil(timeout) { ... }` | `Wait.until(() -> ..., timeout)` | the predicate becomes true |
| `delayWhile(timeout) { ... }` | `Wait.whileTrue(() -> ..., timeout)` | the predicate becomes false |
| `waitForXPDrop()` | `Wait.xpDrop()` | experience is granted |
| `waitForEvent(timeout) { ... }` | — | a matching event arrives |
| `delay(mean, variance)` | `Wait.ms(mean, variance)` | a randomised pause elapses |

The second habit: **never interact without a minimum interval.** A loop that
interacts and returns is re-entered on the next tick. Without a delay on every
path, including early returns, that is click spam.

Use the randomised forms rather than a constant. A delay that is always exactly
400ms is a recognisable pattern.

## 4. State machines, for anything with phases

Kotlin scripts with distinct phases should extend `StateMachineScript` rather
than driving flags by hand:

```kotlin
class MyScript : StateMachineScript<MyScript>() {
    override fun getStartState(): State<MyScript> = Gathering
}

private object Gathering : State<MyScript>() {
    override suspend fun MyScript.checkNext(): State<MyScript>? =
        if (inventory.isFull) Banking else null

    override suspend fun MyScript.stateLoop() {
        // one phase's behaviour
    }
}
```

`checkNext()` returns the next state or null to stay put. `stateLoop()` is that
state's body.

There is no Java equivalent of `StateMachineScript`. In Java, model phases with
an enum field and switch on it inside `onLoop()`.

## 5. Give the user settings

Implement `ConfigurableScript` and declare config items as fields. They appear
in the script's settings panel automatically. This works in both languages:

```kotlin
class MyScript : Script(), ConfigurableScript {
    private val dropLogs = BooleanConfigItem(
        name = "Drop logs",
        description = "Drop instead of banking.",
        initialValue = true,
    )
}
```

Available types are `BooleanConfigItem`, `IntConfigItem`, `StringConfigItem`,
`OptionsConfigItem`, `EnumConfigItem`, `InfoDisplayConfigItem` and
`ConfigSection`. Read a value with `.value`, or `getValue()` from Java.

## 6. Run it

```bash
./gradlew installScripts
```

That builds the jar and copies it to `~/.projectx/scripts/`, which is where the
engine loads script jars from. Kotlin and Java scripts ship in the same jar and
are discovered the same way. Start the engine and your script appears in the list.

While iterating, rebuild and hot-reload rather than restarting the client.

## 7. Distributing

Your jar is yours. The API is published so you can build against it without the
engine source, and nothing requires you to open-source what you write or to
contribute it back.

Two practical notes. Scripts are compiled JVM bytecode, so a jar is
decompilable — treat obfuscation as a speed bump, not protection. And the API
tracks the engine build, so a jar built against one release is not guaranteed to
load against another. Say which engine version yours targets, and rebuild when
it moves.

If you would rather share than sell, open a pull request against
[community-scripts](https://github.com/iEasyScript/community-scripts).
