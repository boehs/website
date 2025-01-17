import mdItToC from "markdown-it-table-of-contents";
import mdItAc from "markdown-it-anchor";
import mdItAttr from "markdown-it-attrs";
import mmdItWl from "@gardeners/markdown-it-wikilinks";
import mdItC from "markdown-it-container";
import mdItOtherAttrLol from "markdown-it-attribution";
import mdItFootnote from "markdown-it-footnote";

import mdIt from "markdown-it";
import sanitize from "sanitize-filename";
import slugify from "../../../utils/slugify.js";

import iterator from "markdown-it-for-inline";

import { transformerNotationDiff } from "@shikijs/transformers";
import { gruvBoxDarkHard } from "./highlight.js";

const proxy = (tokens, idx, options, env, self) =>
    self.renderToken(tokens, idx, options);

async function shiki() {
    return (await import("@shikijs/markdown-it")).default({
        langs: [
            "html",
            "css",
            "scss",
            "javascript",
            "typescript",
            "json",
            "yaml",
            "shell",
            "graphql",
            "rust",
            "swift",
            "regex",
            "toml",
            "liquid",
        ],
        theme: gruvBoxDarkHard,
        transformers: [transformerNotationDiff()],
    });
}

let options = {
    html: true,
    breaks: true,
    typographer: true,
    linkify: true,
};
let markdownIt = mdIt(options);

markdownIt.renderer.rules.blockquote_open = function (token, idx) {
    return `<blockquote${
        token[idx + 2].content.toLowerCase().includes("[[penpen]]'s note")
            ? ` class="penpen"`
            : ""
    }>`;
};

markdownIt
    //.use(require("markdown-it-obsidian")({baseURL: '/pages/c/'}))
    .use(mdItToC, { includeLevel: [2, 3, 4, 5] })
    .use(mdItAc)
    .use(mdItAttr)
    .use(
        mmdItWl({
            postProcessPageName: (pageName) => {
                pageName = pageName.trim();
                pageName = pageName.split("/").map(sanitize).join("/");
                pageName = slugify(pageName);
                return pageName;
            },
            imagePattern: /!\[\[([^]+?)\]\]/,
            assetPrefix: "/assets/",
            uriSuffix: "",
        }),
    )
    // ::: details <Summary goes here>
    .use(mdItC, "details", {
        validate: function (params) {
            return params.trim().match(/^details\s+(.*)$/);
        },

        render: function (tokens, idx) {
            var m = tokens[idx].info.trim().match(/^details\s+(.*)$/);
            if (tokens[idx].nesting === 1) {
                // opening tag
                return (
                    "<details><summary>" +
                    markdownIt.utils.escapeHtml(m[1]) +
                    "</summary>\n"
                );
            } else {
                // closing tag
                return "</details>\n";
            }
        },
    })
    // ::: figure <Figcaption goes here>
    .use(mdItC, "figure", {
        validate: function (params) {
            return params.trim().match(/^figure\s+(.*)$/);
        },

        render: function (tokens, idx) {
            if (tokens[idx].nesting === 1) {
                // opening tag
                return `<figure>\n`;
            } else {
                let i = idx - 1;
                while (tokens[i].type !== "container_figure_open") {
                    i--;
                }
                let m = tokens[i].info.trim().match(/^figure\s+(.*)$/);
                return `<figcaption>${markdownIt.utils.escapeHtml(
                    m[1],
                )}</figcaption></figure>\n`;
            }
        },
    })
    .use(mdItOtherAttrLol, {
        marker: "--",
        removeMarker: false,
    })
    .use(mdItFootnote)
    //.use(mdItFig, {})
    .use(iterator, "external_url_img", "link_open", function (tokens, idx) {
        let host = null;
        try {
            host = new URL(tokens[idx].attrGet("href"));
        } catch {}
        if (host?.hostname != "boehs.org")
            tokens[idx].attrPush([
                "style",
                `--url: url("https://v1.indieweb-avatar.11ty.dev/${encodeURIComponent(
                    `${host?.protocol}//${host?.hostname}`,
                )}")`,
            ]);
    })
    .use(shiki);

markdownIt.renderer.rules.footnote_block_open = () =>
    "<hr/>\n" +
    "<h2>👟 Footnotes</h2>\n" +
    '<section class="footnotes">\n' +
    '<ol class="footnotes-list">\n';

// why did i write this
markdownIt.renderer.rules.footnote_caption = function (tokens, idx) {
    let n = Number(tokens[idx].meta.id + 1).toString();
    if (tokens[idx].meta.subId > 0) n += `:${tokens[idx].meta.subId}`;
    return `${n}`;
};

/**
 * Pintora codeblocks are replaced with a placeholder that is found and replaced
 * by 11ty, as markdown-it does not support async rendering.
 *
 * If it is a codeblock that's *not* a Pintora codeblock, it should fall through
 * to shiki for syntax highlighting.
 */
const defaultFence = markdownIt.renderer.rules.fence || proxy;
markdownIt.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    let info = token.info.trim();
    if (info === "pintora") {
        let id = Math.random().toString(36).substring(7);
        return `___PINTORA_${id}_${token.content.trim()}_`;
    }

    if (info === "js exec" || info === "javascript exec") {
        let id = Math.random().toString(36).substring(7);
        return `___EVAL_${id}_${token.content.trim()}_`;
    }

    return defaultFence(tokens, idx, options, env, self);
};

let ventoCompileFunction;

export function markdownTemplate(eleventyConfig) {
    eleventyConfig.addExtension("md", {
        outputFileExtension: "html",
        compile: async (str, path) => {
            // it would be most optimal to use the `key` property to pipe to vento
            // but we can't have nice things: https://github.com/11ty/eleventy/issues/2827
            // ... or the this.getEngine method, but we don't have `this`.
            // augmentFunctionContext might be helpful: https://github.com/noelforte/eleventy-plugin-vento/issues/9
            // ... maybe look into how the `render` plugin works?
            // ... or if https://github.com/11ty/eleventy/blob/4e97e017714f97025409af437fe0d17694dc6bb6/src/Engines/Markdown.js#L75 was `await`
            // we could use the `setLibrary` method and we wouldn't need to worry about this
            // ... but this code works fine.
            if (!ventoCompileFunction) {
                ventoCompileFunction = [
                    ...eleventyConfig.extensionMap.values(),
                ].find((r) => r.key === "vto").compile;
            }
            return async (data) => {
                let result = str;
                if (str.includes("{{")) {
                    result = await (
                        await ventoCompileFunction(str, path)
                    )(data);
                }
                result = markdownIt.render(result, data);
                if (result.includes("___")) {
                    result = await (
                        await import("./widgets/widgets.js")
                    ).inject(result);
                }
                return result;
            };
        },
    });
    return markdownIt;
}
