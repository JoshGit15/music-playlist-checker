/* =========================================================
   MUSIC PLAYLIST CHECKER
   ========================================================= */


// ---------------------------------------------------------
// ELEMENTS
// ---------------------------------------------------------

const csvInput = document.getElementById("csvInput");
const folderInput = document.getElementById("folderInput");

const csvButton = document.getElementById("csvButton");
const folderButton = document.getElementById("folderButton");

const csvName = document.getElementById("csvName");
const folderName = document.getElementById("folderName");

const scanButton = document.getElementById("scanButton");

const missingButton =
    document.getElementById("missingButton");

const allButton =
    document.getElementById("allButton");

const scanStatus =
    document.getElementById("scanStatus");

const resultsBody =
    document.getElementById("resultsBody");

const resultCount =
    document.getElementById("resultCount");

const foundCount =
    document.getElementById("foundCount");

const possibleCount =
    document.getElementById("possibleCount");

const missingCount =
    document.getElementById("missingCount");

const statusPill =
    document.getElementById("statusPill");

const restoreBanner =
    document.getElementById("restoreBanner");

const restoreSubtitle =
    document.getElementById("restoreSubtitle");

const restoreButton =
    document.getElementById("restoreButton");

const dismissRestoreButton =
    document.getElementById("dismissRestoreButton");

const progressTrack =
    document.getElementById("progressTrack");

const progressFill =
    document.getElementById("progressFill");


// ---------------------------------------------------------
// STATE
// ---------------------------------------------------------

let playlist = [];

let musicFiles = [];

let results = [];

const SESSION_STORAGE_KEY =
    "musicPlaylistChecker.lastSession";


// ---------------------------------------------------------
// SAVED SESSIONS (localStorage)
// ---------------------------------------------------------
//
// Only the RESULTS get saved — actual files/folders can't
// be persisted across page loads for security reasons, so a
// restored session lets you view stats/results and export
// CSVs again, but you'll need to reselect the CSV/folder to
// run a fresh scan.

function saveSession(counts) {

    try {

        localStorage.setItem(
            SESSION_STORAGE_KEY,
            JSON.stringify({
                savedAt: Date.now(),
                csvLabel: csvName.value,
                folderLabel: folderName.value,
                totalSongs: playlist.length,
                found: counts.found,
                possible: counts.possible,
                missing: counts.missing,
                results
            })
        );

    }

    catch (error) {

        // Storage full or unavailable (private browsing,
        // etc.) — not saving a session isn't critical, so
        // just log it and move on.
        console.warn(
            "Could not save scan session:",
            error
        );

    }

}


function formatSavedDate(timestamp) {

    const diffMinutes =
        Math.round(
            (Date.now() - timestamp) / 60000
        );


    if (diffMinutes < 1) {
        return "just now";
    }

    if (diffMinutes < 60) {
        return `${diffMinutes} min ago`;
    }


    const diffHours =
        Math.round(diffMinutes / 60);

    if (diffHours < 24) {
        return `${diffHours}h ago`;
    }


    return new Date(timestamp)
        .toLocaleDateString();

}


function checkForSavedSession() {

    let saved;


    try {

        const raw =
            localStorage.getItem(SESSION_STORAGE_KEY);

        if (!raw) {
            return;
        }

        saved = JSON.parse(raw);

    }

    catch (error) {
        return;
    }


    if (!saved || !Array.isArray(saved.results)) {
        return;
    }


    restoreSubtitle.textContent =
        `${saved.csvLabel || "Playlist"} vs ${
            saved.folderLabel || "folder"
        } • ${saved.totalSongs} tracks • ` +
        `${saved.found} found, ${saved.possible} possible, ` +
        `${saved.missing} missing • saved ${
            formatSavedDate(saved.savedAt)
        }`;


    restoreBanner.hidden = false;


    restoreButton.onclick = () => {

        results = saved.results;


        foundCount.textContent = saved.found;

        possibleCount.textContent = saved.possible;

        missingCount.textContent = saved.missing;


        renderResults();


        resultCount.textContent =
            `${saved.possible + saved.missing} ${
                saved.possible + saved.missing === 1
                    ? "track"
                    : "tracks"
            }`;


        scanStatus.textContent =
            `Restored scan from ${formatSavedDate(saved.savedAt)} — ` +
            `reselect your CSV and folder to run a new scan`;


        statusPill.innerHTML =
            `<span></span> Restored`;


        missingButton.disabled =
            saved.missing === 0;

        allButton.disabled =
            results.length === 0;


        restoreBanner.hidden = true;

    };


    dismissRestoreButton.onclick = () => {

        localStorage.removeItem(SESSION_STORAGE_KEY);

        restoreBanner.hidden = true;

    };

}


checkForSavedSession();


// ---------------------------------------------------------
// FILE BUTTONS
// ---------------------------------------------------------

csvButton.addEventListener("click", () => {
    csvInput.click();
});


folderButton.addEventListener("click", () => {

    // webkitdirectory (folder selection) is only supported
    // in Chromium-based browsers (Chrome, Edge, Opera, Brave).
    // Firefox and Safari will just open a normal file picker,
    // which silently defeats the "select a folder" workflow —
    // so warn instead of letting it fail confusingly.
    const supportsFolderPicker =
        "webkitdirectory" in folderInput;

    if (!supportsFolderPicker) {

        alert(
            "Your browser doesn't support folder selection. " +
            "Please use Chrome, Edge, or another Chromium-based browser."
        );

    }

    folderInput.click();
});


// ---------------------------------------------------------
// CSV SELECTED
// ---------------------------------------------------------

csvInput.addEventListener("change", async () => {

    if (!csvInput.files.length) {
        return;
    }

    const file = csvInput.files[0];

    csvName.value = file.name;

    try {

        const text = await file.text();

        playlist = parseCSV(text);

        updateStatus();

        scanStatus.textContent =
            `${playlist.length} playlist tracks loaded`;

    } catch (error) {

        console.error(error);

        alert("Could not read the Spotify CSV.");

    }

});


// ---------------------------------------------------------
// FOLDER SELECTED
// ---------------------------------------------------------

folderInput.addEventListener("change", () => {

    if (!folderInput.files.length) {
        return;
    }

    musicFiles = [];

    for (const file of folderInput.files) {

        const extension =
            getExtension(file.name);

        if (!isAudioFile(extension)) {
            continue;
        }

        musicFiles.push({
            name: file.name,
            path:
                file.webkitRelativePath ||
                file.name,
            // Precompute once here instead of re-parsing
            // this filename on every song comparison during
            // the scan (was previously recomputed playlist
            // .length times per file).
            parts:
                filenameParts(file.name)
        });
    }


    if (folderInput.files[0].webkitRelativePath) {

        const folder =
            folderInput.files[0]
                .webkitRelativePath
                .split("/")[0];

        folderName.value = folder;

    } else {

        folderName.value =
            `${musicFiles.length} music files`;

    }


    updateStatus();

    scanStatus.textContent =
        `${musicFiles.length} music files loaded`;

});


// ---------------------------------------------------------
// UPDATE STATUS
// ---------------------------------------------------------

function updateStatus() {

    if (playlist.length && musicFiles.length) {

        statusPill.innerHTML =
            `<span></span> Ready to scan`;

    } else {

        statusPill.innerHTML =
            `<span></span> Setup required`;
    }

}


// ---------------------------------------------------------
// AUDIO EXTENSIONS
// ---------------------------------------------------------

const audioExtensions = new Set([

    "mp3",
    "flac",
    "wav",
    "m4a",
    "aac",
    "ogg",
    "opus",
    "wma",
    "alac"

]);


function getExtension(filename) {

    const parts =
        filename
            .toLowerCase()
            .split(".");

    return parts.length > 1
        ? parts.pop()
        : "";

}


function isAudioFile(extension) {

    return audioExtensions.has(extension);

}


// ---------------------------------------------------------
// NORMALIZATION
// ---------------------------------------------------------

function normalize(value) {

    if (!value) {
        return "";
    }

    let text = String(value);

    text = text
        .toLowerCase()
        .replace(/’/g, "'")
        .replace(/–|—/g, "-")
        .replace(/&/g, " and ");


    // Remove brackets
    text = text.replace(/\[[^\]]*\]/g, " ");


    // Keep letters and numbers
    text = text.replace(
        /[^a-z0-9]+/g,
        " "
    );


    // Remove duplicate spaces
    text = text.replace(
        /\s+/g,
        " "
    );


    return text.trim();

}


// ---------------------------------------------------------
// CLEAN TITLE
// ---------------------------------------------------------

function cleanTitle(value) {

    let text = String(value || "");


    // Remove common metadata
    text = text.replace(
        /\s*[\(\[]\s*(official|audio|video|lyrics?|visualizer|hd|hq|4k)[^\)\]]*[\)\]]/gi,
        ""
    );


    // Remove common versions
    text = text.replace(
        /\s*-\s*(single version|radio edit|single edit|remastered|remaster)\s*$/i,
        ""
    );


    return normalize(text);

}


// ---------------------------------------------------------
// TITLE VARIANTS
// ---------------------------------------------------------

function titleVariants(title) {

    const variants = [];

    const original =
        String(title || "").trim();


    variants.push(
        cleanTitle(original)
    );


    // Remove parentheses
    const noParentheses =
        original.replace(
            /\s*[\(\[].*?[\)\]]/g,
            ""
        );


    variants.push(
        normalize(noParentheses)
    );


    // Remove featuring artists
    const noFeatures =
        noParentheses.replace(
            /\s*(feat\.?|ft\.?|featuring|with)\s+.*$/i,
            ""
        );


    variants.push(
        normalize(noFeatures)
    );


    // Remove versions
    const base =
        original.replace(
            /\s*-\s*(single version|radio edit|single edit|remastered|remaster).*$/i,
            ""
        );


    variants.push(
        normalize(base)
    );


    // Some Spotify entries (soundtracks, compilations, deluxe
    // editions) tack on arbitrary description after " - ",
    // e.g. "Popular (with X) - From The Idol Vol. 1 (Music
    // from the HBO Original Series)". The keyword-based
    // stripping above only catches known suffixes like
    // "radio edit". This variant instead just takes whatever
    // comes before the FIRST " - ", which is almost always
    // the real song title regardless of what follows it.
    const dashIndex =
        noParentheses.indexOf(" - ");

    if (dashIndex !== -1) {

        variants.push(
            normalize(
                noParentheses.slice(0, dashIndex)
            )
        );

    }


    return [
        ...new Set(
            variants.filter(Boolean)
        )
    ];

}


// ---------------------------------------------------------
// FILENAME PARTS
// ---------------------------------------------------------

function filenameParts(filename) {

    let name =
        filename.replace(
            /\.[^/.]+$/,
            ""
        );


    name = name.replace(
        /_/g,
        " "
    );


    // Strip leading track numbers, e.g. "03 - Title",
    // "03. Title", "03 Title", "3-03 Title" (disc-track).
    name = name.replace(
        /^\s*(\d{1,2}-)?\d{1,3}\s*[\.\-_\s]\s*/,
        ""
    );


    // Strip common metadata tags anywhere in the name,
    // e.g. "(Remastered 2011)", "[Official Audio]".
    name = name.replace(
        /\s*[\(\[]\s*(official|audio|video|lyrics?|visualizer|hd|hq|4k|remaster(ed)?(\s*\d{4})?|single version|radio edit|explicit|clean)[^\)\]]*[\)\]]/gi,
        ""
    );


    const output = [
        name
    ];


    const separators = [
        " - ",
        " – ",
        " — "
    ];


    for (const separator of separators) {

        if (name.includes(separator)) {

            const parts =
                name.split(separator);

            output.push(parts[0]);

            output.push(
                parts.slice(1).join(separator)
            );

        }

    }


    return output
        .map(normalize)
        .filter(Boolean);

}


// ---------------------------------------------------------
// LEVENSHTEIN DISTANCE
// ---------------------------------------------------------

function levenshtein(a, b) {

    if (a === b) {
        return 0;
    }

    if (!a.length) {
        return b.length;
    }

    if (!b.length) {
        return a.length;
    }


    let previous = [];

    let current = [];


    for (let j = 0; j <= b.length; j++) {
        previous[j] = j;
    }


    for (let i = 1; i <= a.length; i++) {

        current[0] = i;


        for (let j = 1; j <= b.length; j++) {

            const cost =
                a[i - 1] === b[j - 1]
                    ? 0
                    : 1;


            current[j] =
                Math.min(

                    current[j - 1] + 1,

                    previous[j] + 1,

                    previous[j - 1] + cost

                );

        }


        [
            previous,
            current
        ] = [
            current,
            previous
        ];

    }


    return previous[b.length];

}


// ---------------------------------------------------------
// SIMILARITY
// ---------------------------------------------------------

function similarity(a, b) {

    if (!a || !b) {
        return 0;
    }


    if (a === b) {
        return 100;
    }


    // Cheap early exit: if the length difference alone is
    // bigger than the FOUND threshold could tolerate, skip
    // the expensive O(n*m) Levenshtein pass entirely. This
    // matters a lot on large libraries since similarity()
    // is called for every song/file/variant combination.
    const maxLength =
        Math.max(
            a.length,
            b.length
        );

    if (
        maxLength &&
        Math.abs(a.length - b.length) / maxLength > 0.6
    ) {
        return 0;
    }


    const distance =
        levenshtein(a, b);


    if (!maxLength) {
        return 100;
    }


    return (
        1 -
        distance / maxLength
    ) * 100;

}


// ---------------------------------------------------------
// WORD OVERLAP
// ---------------------------------------------------------

function wordOverlap(a, b) {

    const wordsA =
        new Set(a.split(" ").filter(Boolean));

    const wordsB =
        new Set(b.split(" ").filter(Boolean));


    if (!wordsA.size || !wordsB.size) {
        return 0;
    }


    let matches = 0;


    for (const word of wordsA) {

        // Ignore very short/common tokens so a single
        // shared word like "the" or "a" can't drive a match.
        if (word.length < 3) {
            continue;
        }

        if (wordsB.has(word)) {
            matches++;
        }

    }


    if (!matches) {
        return 0;
    }


    // Jaccard-style overlap: score is relative to the
    // UNION of both word sets, not just the shorter title.
    // This stops a one-word song title from scoring high
    // against a long, mostly-unrelated filename.
    const union = new Set([
        ...wordsA,
        ...wordsB
    ]);


    return (
        matches /
        union.size
    ) * 94;

}


// ---------------------------------------------------------
// SCORE MATCH
// ---------------------------------------------------------

function scoreSong(song, file) {

    const variants =
        titleVariants(song.title);


    const parts =
        file.parts ||
        filenameParts(file.name);


    let best = 0;


    for (const part of parts) {

        for (const variant of variants) {

            if (part === variant) {

                best =
                    Math.max(
                        best,
                        100
                    );

                continue;

            }


            if (
                variant &&
                (
                    ` ${part} `
                ).includes(
                    ` ${variant} `
                )
            ) {

                best =
                    Math.max(
                        best,
                        98
                    );

            }


            best =
                Math.max(
                    best,
                    similarity(
                        variant,
                        part
                    )
                );


            best =
                Math.max(
                    best,
                    wordOverlap(
                        variant,
                        part
                    )
                );

        }

    }


    // Artist bonus
    const artists =
        String(song.artist || "")
            .split(";")
            .map(normalize)
            .filter(Boolean);


    let artistHits = 0;


    for (const artist of artists) {

        if (
            parts.some(
                part =>
                    part.includes(artist)
            )
        ) {

            artistHits++;

        }

    }


    if (best >= 90) {

        best =
            Math.min(
                100,
                best +
                artistHits * 3
            );

    }


    return Math.min(
        100,
        best
    );

}


// ---------------------------------------------------------
// PARSE CSV
// ---------------------------------------------------------

function parseCSV(text) {

    const rows = [];

    let row = [];

    let field = "";

    let insideQuotes = false;


    for (let i = 0; i < text.length; i++) {

        const char = text[i];

        const next = text[i + 1];


        if (char === '"' && insideQuotes && next === '"') {

            field += '"';

            i++;

            continue;

        }


        if (char === '"') {

            insideQuotes =
                !insideQuotes;

            continue;

        }


        if (char === "," && !insideQuotes) {

            row.push(field);

            field = "";

            continue;

        }


        if (
            (
                char === "\n" ||
                char === "\r"
            ) &&
            !insideQuotes
        ) {

            if (char === "\r" && next === "\n") {
                i++;
            }


            row.push(field);

            field = "";


            if (
                row.some(
                    value =>
                        value.trim()
                )
            ) {

                rows.push(row);

            }


            row = [];

            continue;

        }


        field += char;

    }


    if (field || row.length) {

        row.push(field);

        rows.push(row);

    }


    if (!rows.length) {
        return [];
    }


    const headers =
        rows[0].map(
            header =>
                header.trim()
        );


    const titleIndex =
        findColumn(
            headers,
            [
                "Track Name",
                "title",
                "Title"
            ]
        );


    const artistIndex =
        findColumn(
            headers,
            [
                "Artist Name(s)",
                "artist",
                "Artist"
            ]
        );


    // Exportify-style exports usually include a "Track URI"
    // (spotify:track:XXXX) or sometimes a direct URL/ID
    // column. Try each so we can link straight to the song
    // instead of falling back to a search.
    const uriIndex =
        findColumn(
            headers,
            [
                "Track URI",
                "Spotify URI",
                "URI",
                "Track URL",
                "Spotify URL",
                "URL"
            ]
        );

    const idIndex =
        findColumn(
            headers,
            [
                "Track ID",
                "Spotify ID",
                "Id",
                "ID"
            ]
        );


    if (titleIndex === -1) {

        throw new Error(
            "Track Name column not found."
        );

    }


    const output = [];


    for (let i = 1; i < rows.length; i++) {

        const current =
            rows[i];


        const title =
            current[titleIndex] || "";


        const artist =
            artistIndex !== -1
                ? current[artistIndex] || ""
                : "";


        if (title.trim()) {

            let spotifyUrl = "";


            if (uriIndex !== -1) {

                spotifyUrl =
                    spotifyLinkFromRaw(
                        current[uriIndex] || ""
                    );

            }


            if (!spotifyUrl && idIndex !== -1) {

                const id =
                    (current[idIndex] || "").trim();

                if (id) {

                    spotifyUrl =
                        `https://open.spotify.com/track/${id}`;

                }

            }


            if (!spotifyUrl) {

                spotifyUrl =
                    spotifySearchUrl(
                        title.trim(),
                        artist.trim()
                    );

            }


            output.push({

                title:
                    title.trim(),

                artist:
                    artist.trim(),

                spotifyUrl

            });

        }

    }


    return output;

}


// ---------------------------------------------------------
// SPOTIFY LINKS
// ---------------------------------------------------------

function spotifyLinkFromRaw(raw) {

    const value =
        String(raw || "").trim();

    if (!value) {
        return "";
    }


    // Already a URL, e.g. https://open.spotify.com/track/xxx
    if (/^https?:\/\//i.test(value)) {
        return value;
    }


    // Spotify URI format, e.g. spotify:track:xxxx
    const uriMatch =
        value.match(/^spotify:track:([A-Za-z0-9]+)/i);

    if (uriMatch) {

        return (
            `https://open.spotify.com/track/${uriMatch[1]}`
        );

    }


    // Bare Spotify track ID (base62, ~22 chars)
    if (/^[A-Za-z0-9]{15,30}$/.test(value)) {

        return (
            `https://open.spotify.com/track/${value}`
        );

    }


    return "";

}


function spotifySearchUrl(title, artist) {

    const query =
        [title, artist]
            .filter(Boolean)
            .join(" ");


    return (
        `https://open.spotify.com/search/${
            encodeURIComponent(query)
        }`
    );

}


// Older saved sessions (from before this feature existed)
// won't have a spotifyUrl on their results, so compute a
// search-link fallback on the fly rather than showing
// nothing for them.
function resultSpotifyUrl(result) {

    if (result.spotifyUrl) {
        return result.spotifyUrl;
    }


    return spotifySearchUrl(
        result.title || "",
        result.artist || ""
    );

}


// ---------------------------------------------------------
// FIND CSV COLUMN
// ---------------------------------------------------------

function findColumn(headers, possibleNames) {

    for (const name of possibleNames) {

        const index =
            headers.findIndex(
                header =>
                    header.toLowerCase() ===
                    name.toLowerCase()
            );


        if (index !== -1) {
            return index;
        }

    }


    return -1;

}


// ---------------------------------------------------------
// SCAN
// ---------------------------------------------------------

scanButton.addEventListener(
    "click",
    async () => {

        if (!playlist.length) {

            alert(
                "Please select your Spotify CSV first."
            );

            return;

        }


        if (!musicFiles.length) {

            alert(
                "Please select your music folder first."
            );

            return;

        }


        scanButton.disabled = true;

        missingButton.disabled = true;

        allButton.disabled = true;


        scanStatus.textContent =
            "Scanning your library…";


        statusPill.innerHTML =
            `<span></span> Scanning`;


        progressTrack.hidden = false;

        progressFill.style.width = "0%";


        restoreBanner.hidden = true;


        results = [];


        let found = 0;

        let possible = 0;

        let missing = 0;


        try {


        for (
            let i = 0;
            i < playlist.length;
            i++
        ) {

            const song =
                playlist[i];


            let bestScore = 0;

            let bestFile = null;


            for (const file of musicFiles) {

                let score = 0;


                try {

                    score =
                        scoreSong(
                            song,
                            file
                        );

                }

                catch (error) {

                    // Don't let one malformed song/filename
                    // combination silently kill the entire
                    // scan (which would freeze the progress
                    // bar wherever it was). Skip this pairing
                    // and keep going.
                    console.warn(
                        "Skipped a comparison due to an error:",
                        song,
                        file,
                        error
                    );

                    continue;

                }


                if (score > bestScore) {

                    bestScore = score;

                    bestFile = file;

                }

            }


            let status;


            if (bestScore >= 92) {

                status = "FOUND";

                found++;

            }

            else if (bestScore >= 78) {

                status = "POSSIBLE";

                possible++;

            }

            else {

                status = "MISSING";

                missing++;

            }


            results.push({

                status,

                title:
                    song.title,

                artist:
                    song.artist,

                score:
                    Number(
                        bestScore.toFixed(1)
                    ),

                file:
                    bestFile
                        ? bestFile.name
                        : "",

                path:
                    bestFile
                        ? bestFile.path
                        : "",

                spotifyUrl:
                    song.spotifyUrl || ""

            });


            scanStatus.textContent =
                `Scanning ${i + 1} / ${playlist.length}`;


            progressFill.style.width =
                `${((i + 1) / playlist.length * 100).toFixed(1)}%`;


            // Yield to the browser after every song so the
            // progress bar and status text actually get
            // painted, even on a large library where scoring
            // one song against many files takes a while.
            await delay(0);

        }


        // Update statistics

        foundCount.textContent =
            found;

        possibleCount.textContent =
            possible;

        missingCount.textContent =
            missing;


        renderResults();


        resultCount.textContent =
            `${possible + missing} ${
                possible + missing === 1
                    ? "track"
                    : "tracks"
            }`;


        scanStatus.textContent =
            `Finished • ${playlist.length} tracks checked`;


        statusPill.innerHTML =
            `<span></span> Scan complete`;


        saveSession({
            found,
            possible,
            missing
        });


        }

        catch (error) {

            // If anything unexpected goes wrong mid-scan,
            // surface it instead of leaving the progress bar
            // and buttons frozen forever.
            console.error(
                "Scan failed:",
                error
            );

            scanStatus.textContent =
                "Scan failed — see console for details";

            statusPill.innerHTML =
                `<span></span> Scan failed`;

            alert(
                "Something went wrong during the scan. " +
                "Check the browser console for details."
            );

        }

        finally {

            progressTrack.hidden = true;

            scanButton.disabled = false;

            missingButton.disabled =
                missing === 0;

            allButton.disabled =
                results.length === 0;

        }

    }
);


// ---------------------------------------------------------
// RENDER RESULTS
// ---------------------------------------------------------

function renderResults() {

    const unresolved =
        results.filter(
            result =>
                result.status === "MISSING" ||
                result.status === "POSSIBLE"
        );


    if (!unresolved.length) {

        resultsBody.innerHTML = `

            <tr>

                <td colspan="6">

                    <div class="empty">

                        <div class="empty-icon">
                            ✓
                        </div>

                        <strong>
                            Everything is matched
                        </strong>

                        <span>
                            All playlist tracks were found
                            in your library.
                        </span>

                    </div>

                </td>

            </tr>

        `;

        return;

    }


    resultsBody.innerHTML =
        unresolved
            .map(result => `

                <tr>

                    <td>

                        <span
                            class="badge ${
                                result.status.toLowerCase()
                            }"
                        >

                            ${result.status}

                        </span>

                    </td>


                    <td>
                        ${escapeHTML(
                            result.title
                        )}
                    </td>


                    <td>
                        ${escapeHTML(
                            result.artist
                        )}
                    </td>


                    <td class="match-score">

                        ${result.score.toFixed(1)}%

                    </td>


                    <td
                        class="local-file"
                        title="${escapeHTML(
                            result.path
                        )}"
                    >

                        ${
                            result.file
                                ? escapeHTML(
                                    result.file
                                  )
                                : "No close match"
                        }

                    </td>


                    <td>

                        <a
                            class="spotify-button"
                            href="${escapeHTML(
                                resultSpotifyUrl(result)
                            )}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Spotify Link
                        </a>

                    </td>

                </tr>

            `)
            .join("");

}


// ---------------------------------------------------------
// EXPORT MISSING
// ---------------------------------------------------------

missingButton.addEventListener(
    "click",
    () => {

        const missing =
            results.filter(
                result =>
                    result.status ===
                    "MISSING"
            );


        const rows = [
            [
                "title",
                "artist",
                "spotify_link"
            ]
        ];


        for (const result of missing) {

            rows.push([
                result.title,
                result.artist,
                resultSpotifyUrl(result)
            ]);

        }


        downloadCSV(
            rows,
            "missing_songs.csv"
        );

    }
);


// ---------------------------------------------------------
// EXPORT ALL
// ---------------------------------------------------------

allButton.addEventListener(
    "click",
    () => {

        const rows = [

            [
                "Status",
                "Track Name",
                "Artist",
                "Score",
                "Local File",
                "Spotify Link"
            ]

        ];


        for (const result of results) {

            rows.push([

                result.status,

                result.title,

                result.artist,

                result.score,

                result.path,

                resultSpotifyUrl(result)

            ]);

        }


        downloadCSV(
            rows,
            "playlist_results.csv"
        );

    }
);


// ---------------------------------------------------------
// CSV DOWNLOAD
// ---------------------------------------------------------

function downloadCSV(rows, filename) {

    const csv =
        rows
            .map(
                row =>
                    row
                        .map(
                            value =>
                                `"${String(value ?? "")
                                    .replace(
                                        /"/g,
                                        '""'
                                    )}"`
                        )
                        .join(",")
            )
            .join("\r\n");


    const blob =
        new Blob(
            [csv],
            {
                type:
                    "text/csv;charset=utf-8;"
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const link =
        document.createElement("a");


    link.href = url;

    link.download = filename;

    document.body.appendChild(link);

    link.click();

    link.remove();


    URL.revokeObjectURL(url);

}


// ---------------------------------------------------------
// HTML ESCAPE
// ---------------------------------------------------------

function escapeHTML(value) {

    return String(value ?? "")
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


// ---------------------------------------------------------
// DELAY
// ---------------------------------------------------------

function delay(ms) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    );

}