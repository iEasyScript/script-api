# Sharing and selling your scripts

A Project X script is a single `.jar` file. You can give that file to anyone, or
sell it, and they run it by dropping it into their scripts folder. This guide
covers how that works, how to build a jar other people can use, and what to know
before you charge for one.

Project X itself is free. It does not host, sell or take payment for any
script, and nothing in it handles licences, refunds or support. Anything you sell
is between you and your buyer.

If you would rather share than sell, the easiest route is a pull request against
[community-scripts](https://github.com/iEasyScript/community-scripts): everyone
with the launcher gets it without handling files.

## How a jar gets loaded

1. The engine looks for `.jar` files in the scripts folder:
   - Windows: `C:\Users\<name>\.projectx\scripts\`
   - Linux and macOS: `~/.projectx/scripts/`

   Only the top level of that folder is read. A jar inside a subfolder is ignored.
2. Inside each jar, every class that extends `Script` (Kotlin) or `JavaScript`
   (Java), is not abstract, and carries `@ScriptDescription` is a script. A class
   that fails to load is skipped on its own, so one broken script does not take
   the rest of the jar down with it.
3. Jars are read when the engine is injected. If the client is already running,
   **Reload** in the overlay's Library tab picks up a jar added since.
4. The script then appears in the overlay's **Store** tab, listed under
   **Your scripts**. The user clicks **Add** to put it in their **Library**, where
   they start and configure it.

That is the whole install: copy the jar in, reload or reinject, add it from the
Store.

## Building a jar other people can use

Start from [script-template](https://github.com/iEasyScript/script-template),
which is already set up correctly. Then:

**Build the jar.** Run `./gradlew jar` (`gradlew.bat jar` on Windows). The file
to hand out is the one in `build/libs/`. `installScripts` also copies it into
your own scripts folder for testing.

**Keep the API out of it.** The engine and core API jars must stay `compileOnly`,
as they are in the template. The engine already has those classes loaded; a copy
inside your jar would shadow the running engine.

**Bundle the libraries the engine does not have.** The engine already provides
the Kotlin standard library, `kotlinx-coroutines`, `kotlinx-serialization` and
Gson, so those need nothing. Any other library your script uses has to travel inside your jar, for
example with the Gradle Shadow plugin. Relocate it to your own package, so two
scripts bundling different versions of the same library cannot clash.

**Use your own package and jar name.**
- Put your classes under a package that is yours, such as
  `com.yourname.scripts`. Two jars that contain the same class name cannot both
  load it, so a generic package like `com.projectx.script.impl` risks your script
  silently loading someone else's class.
- Do not start your jar's file name with `official-scripts` or
  `community-scripts`. The launcher manages jars with those names and replaces or
  removes them when those channels update, which would delete yours.

**Say which API version you built against.** The API tracks the engine, and a jar
built against one release is not guaranteed to load against another. Put the
`projectxApiVersion` you used in your script's description or your release notes,
and rebuild when the engine moves on.

**Test the exact file you hand out.** Remove your development copy from your
scripts folder, drop in the jar from `build/libs/`, reload, and add it from the
Store, the same way a user will.

## Before you sell a script

### A jar can be copied and read

A jar is ordinary Java bytecode.

- **Copying:** anyone who has the file can pass it on. Nothing in Project X ties a
  jar to the person who bought it.
- **Reading:** free tools turn a jar back into readable source in minutes.
- **Licence checks:** any check you add is your own code, and whoever has the jar
  can find it and remove it.

Treat everything inside a jar you sell as something the buyer can see and share.

### Obfuscation

An obfuscator such as ProGuard renames and scrambles your classes, which makes a
decompiled jar much harder to follow. It slows people down; it does not stop
them.

If you obfuscate, the engine still has to find and configure your script, so
keep these parts untouched:

- **Script classes:** every class with `@ScriptDescription`, and its name.
- **Script methods:** the methods the engine calls, such as `loop()`,
  `onLoop()`, `onStart()`, `onStop()`, `onEvent()`, `render()`,
  `beforeEachStep()` and `shouldInterrupt()`.
- **Settings fields:** every field of a `ConfigurableScript`. The settings window
  is built from those fields in the order they are declared, and saved values are
  stored under their field names. Renaming or reordering them scrambles the
  window and loses what the user saved.

A ProGuard starting point:

```
-keep @com.projectx.script.ScriptDescription class * {
    public protected *;
}
-keepclassmembers class * implements com.projectx.script.ConfigurableScript {
    <fields>;
}
-dontwarn com.projectx.**
-dontwarn org.projectx.**
-dontwarn world.gregs.**
```

Run the obfuscated jar through the testing step above before you ship it.

### Buyers are trusting you with their PC

A script runs inside the game client with everything the client can do: it can
read and write files, reach the network and run other code. A buyer installing
your jar is trusting you with their computer and their account. Only ask people
to install jars you built yourself from source you control, and never bundle
anything that is not the script.

### Keep the business side clear

Project X does not take payments, verify buyers, issue refunds or resolve
disputes. Say plainly what a buyer gets, which API version it is built for, and
how you handle updates and support.

## For people installing a jar someone gave them

- **Trust:** only install jars from people you trust. A script can do anything
  the game client can on your PC.
- **Install:** put the `.jar` directly in `.projectx\scripts\`, not in a
  subfolder.
- **Find it:** reinject, or click **Reload** in the Library tab. Open the Store,
  find it under **Your scripts**, and click **Add**.
- **If it doesn't appear:** check the jar is in the top-level folder. If it still
  isn't listed, it may have been built for a different engine version; ask its
  developer for a rebuild.
- **Remove it:** delete the jar, then reload or reinject.
