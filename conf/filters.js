import { readFileSync } from "fs";
import slugify from "../utils/slugify.js";
const flowerFile = readFileSync("src/_data/anim/starynight.txt", "utf8");

// These two functions implement the email obfuscation technique
const railsEncode = (msg, rails) =>
    fence(msg.length, rails)
        .map((i) => msg[i])
        .join("");

function fence(length, rails) {
    const cycle_len = 2 * rails - 2;
    return Array.from({ length: rails }).flatMap((_, r) =>
        Array.from({ length }, (_, i) => i).filter(
            (i) => i % cycle_len === r || i % cycle_len === cycle_len - r,
        ),
    );
}

/** @param {import("@11ty/eleventy").UserConfig} eleventyConfig */
export default function filters(eleventyConfig) {
    eleventyConfig.addFilter("titleCase", (str) => {
        str = str
            .split(" ")
            .map((word) => {
                if (/[A-Z]/.test(word)) {
                    return word;
                }
                return word.charAt(0).toUpperCase() + word.slice(1);
            })
            .join(" ");
        // Certain minor words should be left lowercase unless
        // they are the first or last words in the string
        let lowers = [
            "A",
            "An",
            "The",
            "And",
            "But",
            "Or",
            "For",
            "Nor",
            "As",
            "At",
            "By",
            "For",
            "From",
            "In",
            "Into",
            "Near",
            "Of",
            "On",
            "Onto",
            "To",
            "With",
        ];
        for (const lower of lowers)
            str = str.replace(new RegExp("\\s" + lower + "\\s", "g"), (txt) =>
                txt.toLowerCase(),
            );

        return str;
    });

    // I frankly don't recall why I don't use the built-in slug filter
    // but I'm sure I had a good reason
    eleventyConfig.addFilter("slugshive", (path) => slugify(path));

    eleventyConfig.addFilter(
        "rails",
        (str, n) =>
            `<a class="rails" href="mailto:${railsEncode(
                str,
                n,
            )}" n="${n}">${railsEncode(str, n)}</a>`,
    );

    // sorry
    eleventyConfig.addFilter("footerBase", () => {
        return (
            "\n".repeat(flowerFile.split("?")[0].split("\n").length - 1) +
            // @ts-ignore
            flowerFile
                .match(/([^\n]*)\n\?/)[1]
                .replace(/[0-9]/g, (match) =>
                    " ".repeat(Number(match) + 2).substring(1),
                )
        );
    });

    eleventyConfig.addFilter("random", function (array) {
        return array[Math.floor(Math.random() * array.length)];
    });

    eleventyConfig.addFilter("rainbow", function (i, n) {
        return `hsl(${(360 / n) * i},50%,60%)`;
    });

    eleventyConfig.addFilter("dateToRfc3339", (date) => {
        if (!date) return;
        let s = date.toISOString().split(".");
        s.pop();
        return s.join("") + "Z";
    });

    eleventyConfig.addFilter("getNewestCollectionItemDate", (collection) => {
        return new Date(
            Math.max(
                ...collection.map((item) => new Date(item.date).getTime()),
            ),
        );
    });
}
