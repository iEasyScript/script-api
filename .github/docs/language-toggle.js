(() => {
    const root = new URL(window.pathToRoot ?? "", location.href);
    const isJava = root.pathname.endsWith("/java/");
    const otherRoot = new URL(isJava ? ".." : "java/", root);
    const page = decodeURI(location.href.slice(root.href.length).split(/[?#]/)[0]) || "index.html";

    const split = path => {
        const parts = path.split("/");
        const name = parts.pop().replace(/\.html$/, "");
        return { dirs: parts, name };
    };
    const join = (dirs, name) => [...dirs, name + ".html"].join("/");
    // Dokka names a member called "index" --index-- so it can't clash with the folder's index.html.
    const unescape = name => (name === "--index--" ? "index" : name);
    const getter = name => {
        const plain = unescape(name);
        return (plain.startsWith("-") ? "get" : "get-") + plain;
    };
    const property = name => {
        const m = name.match(/^(?:get|set)-(.*)$/);
        return m ? [m[1], "-" + m[1], ...(m[1] === "index" ? ["--index--"] : [])] : [];
    };
    const isPackageLevel = dirs => dirs.length === 2;

    // Kotlin-as-Java moves top-level functions into their file class, companion members onto the class,
    // properties to getters and nested-class constructors to Outer.Inner.
    const javaCandidates = (path, pages) => {
        const { dirs, name } = split(path);
        const last = dirs[dirs.length - 1];
        const found = [path, join(dirs, getter(name))];
        if (last === "-companion") found.push(join(dirs.slice(0, -1), name), join(dirs.slice(0, -1), getter(name)));
        if (isPackageLevel(dirs)) {
            const prefix = dirs.join("/") + "/";
            const inFileClass = loc => {
                const rest = loc.slice(prefix.length).split("/");
                return rest.length === 2 && rest[0].endsWith("-kt") && [name + ".html", getter(name) + ".html"].includes(rest[1]);
            };
            found.push(...pages.filter(loc => loc.startsWith(prefix) && inFileClass(loc)));
        }
        if (name === last) {
            const prefix = dirs.join("/") + "/";
            found.push(...pages.filter(loc => loc.startsWith(prefix) && loc.endsWith("." + name + ".html") && !loc.slice(prefix.length).includes("/")));
        }
        return found;
    };

    const kotlinCandidates = path => {
        const { dirs, name } = split(path);
        const last = dirs[dirs.length - 1] ?? "";
        const names = [name, ...property(name)];
        const found = [path];
        const owners = [dirs, [...dirs, "-companion"]];
        if (last.endsWith("-kt")) owners.unshift(dirs.slice(0, -1));
        for (const owner of owners) for (const n of names) found.push(join(owner, n));
        if (name.endsWith("." + last)) found.push(join(dirs, last));
        return found;
    };

    const enclosingPages = path => {
        const { dirs } = split(path);
        const found = [];
        for (let i = dirs.length; i > 0; i--) found.push(join(dirs.slice(0, i), "index"));
        return found;
    };

    const loadPages = async siteRoot => {
        try {
            const pages = await (await fetch(new URL("scripts/pages.json", siteRoot))).json();
            return pages.map(p => p.location.split("#")[0]);
        } catch {
            return [];
        }
    };

    const exists = url => fetch(url, { method: "HEAD" }).then(r => r.ok, () => false);

    const counterpart = async () => {
        const pages = await loadPages(otherRoot);
        const known = new Set(pages);
        const mapped = isJava ? kotlinCandidates(page) : javaCandidates(page, pages);
        const urlOf = p => new URL(encodeURI(p), otherRoot).href + (p === page ? location.hash : "");
        const hit = mapped.find(p => known.has(p));
        if (hit) return urlOf(hit);
        const unindexed = mapped.filter(p => !known.has(p));
        const present = await Promise.all(unindexed.map(p => exists(new URL(encodeURI(p), otherRoot))));
        const probed = unindexed.find((_, i) => present[i]);
        if (probed) return urlOf(probed);
        for (const p of enclosingPages(page)) {
            const url = new URL(encodeURI(p), otherRoot);
            if (known.has(p) || await exists(url)) return url.href;
        }
        return new URL("index.html", otherRoot).href;
    };

    const option = (label, active) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = label;
        b.className = "language-toggle--option" + (active ? " language-toggle--option_active" : "");
        b.setAttribute("aria-pressed", String(active));
        if (!active) b.addEventListener("click", async () => {
            b.disabled = true;
            location.href = await counterpart();
        });
        return b;
    };

    const kotlinSource = async () => {
        for (const p of kotlinCandidates(page)) {
            const response = await fetch(new URL(encodeURI(p), otherRoot)).catch(() => null);
            if (response?.ok) return response.text();
        }
        return "";
    };

    // Kotlin-as-Java hides suspend, so a Java reader would take these for ordinary static methods.
    const flagSuspend = async () => {
        const cover = document.querySelector('#content[data-page-type="member"] .cover');
        if (!cover || !/token keyword">suspend /.test(await kotlinSource())) return;
        const note = document.createElement("div");
        note.className = "kotlin-only-note";
        note.innerHTML = "<strong>Kotlin only.</strong> In Kotlin this is a <code>suspend</code> function, which Java " +
            "can't call. Java scripts return the matching <code>Wait</code> instead: see " +
            "<a href=\"https://github.com/iEasyScript/script-api/blob/main/WRITING-SCRIPTS.md#every-kotlin-helper-that-waits-has-a-wait\">" +
            "Every Kotlin helper that waits has a Wait</a>.";
        cover.after(note);
    };

    const mount = () => {
        const controls = document.querySelector(".navigation-controls");
        if (!controls || controls.querySelector(".language-toggle")) return;
        const toggle = document.createElement("div");
        toggle.className = "language-toggle";
        toggle.setAttribute("role", "group");
        toggle.setAttribute("aria-label", "Show signatures in");
        toggle.append(option("Kotlin", !isJava), option("Java", isJava));
        controls.prepend(toggle);
        if (isJava) flagSuspend();
    };

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
    else mount();
})();
