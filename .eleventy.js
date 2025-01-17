import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const collectionControl = require("./src/_data/collectionsControl.json");

// the files we want to use for our collections
let gardenStr = "./src/pages/garden/node/**/*.{md,csv}";

import slugify from "./utils/slugify.js";

import scss from "./conf/templating/scss.js";
import { markdownTemplate } from "./conf/templating/markdown/index.js";
import csv from "./conf/templating/csv.js";
import vento from "./conf/templating/vento.js";

import {
    embedMastodon,
    embedBluesky,
} from "./conf/components/social/social.js";
import javascript from "./conf/templating/javascript.js";
import filters from "./conf/filters.js";

Error.stackTraceLimit = 100;

/** @param {import("@11ty/eleventy").UserConfig} eleventyConfig */
export default function (eleventyConfig) {
    eleventyConfig.addPlugin(vento);

    const markdown = markdownTemplate(eleventyConfig);

    filters(eleventyConfig);

    eleventyConfig.addAsyncShortcode("embedMastodon", embedMastodon);
    eleventyConfig.addAsyncShortcode("embedBluesky", embedBluesky);

    eleventyConfig.addFilter("renderMd", (content) =>
        content ? markdown.render(content) : "",
    );

    eleventyConfig.setFrontMatterParsingOptions({
        // @ts-ignore
        excerpt: (file, options) =>
            (file.excerpt = file.content.split("\n").slice(0, 4).join(" ")),
    });

    eleventyConfig.addPassthroughCopy({ "./src/_public/": "." });
    eleventyConfig.addPassthroughCopy({
        "./src/pages/garden/node/Assets/*": "assets",
    });

    eleventyConfig.addTransform("html", async function (content) {
        if (
            this.page.outputPath &&
            this.page.outputPath.endsWith(".html") &&
            process.env.ELEVENTY_ENV == "production"
        ) {
            return (await import("html-minifier")).minify(content, {
                useShortDoctype: true,
                removeComments: true,
                collapseWhitespace: true,
            });
        }
        return content;
    });

    // I won't even attempt to explain this
    eleventyConfig.addCollection("wtf", function (collectionApi) {
        // ok I lied
        // acess the first post that can get the information we need
        const firstPost = collectionApi.getFilteredByGlob(gardenStr)[0].data;
        // and then pass it to itself to emulate computed
        const links = firstPost.eleventyComputed.brokenLinks(firstPost, true);
        // return as array for pagination
        return Array.from(links);
    });

    eleventyConfig.addCollection("ogReady", function (collectionApi) {
        return collectionApi
            .getFilteredByGlob("./src/pages/**/*.*")
            .filter(function (item) {
                return (
                    item.outputPath.endsWith("html") &&
                    item.page.inputPath.endsWith(".md") &&
                    item.data.title != "missing"
                );
            });
    });

    eleventyConfig.addCollection("redirects", function (collectionApi) {
        // lets make a variable to hold our redirects
        let redirects = [];
        // We need to get each post in our posts folder. In my case this is /node
        const nodes = collectionApi.getFilteredByGlob(gardenStr);
        // next lets iterate over all the nodes
        nodes.forEach((node) =>
            // for each alias
            (node.data.aliases || []).forEach((alias) =>
                // push the target url and the old url
                redirects.push([
                    slugify(node.data.page.url),
                    slugify(node.data.page.url).replace(
                        /\/[^\/]*?(\..+)?$/,
                        `/${node.data.dontSlug ? alias : slugify(alias)}$1`,
                    ),
                ]),
            ),
        );

        return redirects;
    });

    eleventyConfig.addCollection("taxes", function (collectionApi) {
        // lets make a variable to hold our taxonomies and values
        let taxAndValues = [];
        // We need to get each post in our posts folder. In my case this is /node
        const nodes = collectionApi.getFilteredByGlob(gardenStr);
        // next lets iterate over all the nodes
        nodes.forEach((node) => {
            // and then iterate over the taxonomies
            for (const [taxonomy, value] of Object.entries(collectionControl)) {
                // I don't want to paginate date, for instance
                // this is why my collectionControl is using objects instead of arrays
                // @ts-ignore
                if (value.excludeFromPagination) continue;
                else if (node?.data?.[taxonomy]) {
                    // this is typeof on drugs
                    switch (
                        {}.toString
                            .call(node.data[taxonomy])
                            .match(/\s([a-zA-Z]+)/)[1]
                            .toLowerCase()
                    ) {
                        // if it is an array (for tags especially)
                        case "array":
                            node.data[taxonomy].forEach((item) => {
                                taxAndValues.push([taxonomy, item]);
                            });
                            break;
                        // otherwise
                        default:
                            taxAndValues.push([taxonomy, node.data[taxonomy]]);
                    }
                }
            }
        });

        // custom set, sets don't work with objects
        // @ts-ignore
        const unique = [...new Set(taxAndValues.map(JSON.stringify))].map(
            // @ts-ignore
            JSON.parse,
        );

        return unique;
    });

    eleventyConfig.addCollection("taxesDiffer", function (collectionApi) {
        let taxAndValues = [];
        const nodes = collectionApi.getFilteredByGlob(gardenStr);
        const differ =
            Object.keys(collectionControl)[
                Object.values(collectionControl).findIndex(
                    // @ts-ignore
                    (value) => value.mode == "differentiator",
                )
            ];
        nodes.forEach((node) => {
            for (const [taxonomy, value] of Object.entries(collectionControl)) {
                // @ts-ignore
                if (value.excludeFromPagination) continue;
                else if (node?.data?.[taxonomy]) {
                    switch (
                        {}.toString
                            .call(node.data[taxonomy])
                            .match(/\s([a-zA-Z]+)/)[1]
                            .toLowerCase()
                    ) {
                        case "array": {
                            node.data[taxonomy].forEach((item) => {
                                if (
                                    !(
                                        taxonomy == differ &&
                                        item == node.data[differ]
                                    )
                                )
                                    taxAndValues.push([
                                        taxonomy,
                                        item,
                                        node.data[differ],
                                    ]);
                            });
                            break;
                        }
                        default:
                            if (
                                !(
                                    taxonomy == differ &&
                                    node.data[taxonomy] == node.data[differ]
                                )
                            )
                                taxAndValues.push([
                                    taxonomy,
                                    node.data[taxonomy],
                                    node.data[differ],
                                ]);
                    }
                }
            }
        });

        // custom set, sets don't work with objects
        // @ts-ignore
        const unique = [...new Set(taxAndValues.map(JSON.stringify))].map(
            // @ts-ignore
            JSON.parse,
        );

        return unique;
    });

    eleventyConfig.addCollection("nestedTax", function (collectionApi) {
        let nestedTax = {};
        const nodes = collectionApi.getFilteredByGlob(gardenStr);
        nodes.forEach((node) => {
            for (const [taxonomy, value] of Object.entries(collectionControl)) {
                const taxValue = node.data[taxonomy];

                // @ts-ignore
                if (value.excludeFromPagination) continue;
                else if (node?.data?.[taxonomy]) {
                    if (!nestedTax[taxonomy]) nestedTax[taxonomy] = {};
                    switch (
                        {}.toString
                            .call(taxValue)
                            .match(/\s([a-zA-Z]+)/)[1]
                            .toLowerCase()
                    ) {
                        case "array": {
                            taxValue.forEach((item) => {
                                // if the value in the object does not yet exist
                                if (!nestedTax[taxonomy][item])
                                    nestedTax[taxonomy][item] = [];
                                // then add the entire page to it
                                nestedTax[taxonomy][item].push(node);
                            });
                            break;
                        }
                        // otherwise
                        default: {
                            // if the value in the object does not yet exist
                            if (!nestedTax[taxonomy][taxValue])
                                nestedTax[taxonomy][taxValue] = [];
                            // then add the entire page to it
                            nestedTax[taxonomy][taxValue].push(node);
                        }
                    }
                }
            }
        });

        return nestedTax;
    });

    javascript(eleventyConfig);
    scss(eleventyConfig);
    csv(eleventyConfig, markdown);

    eleventyConfig.setQuietMode(true);

    return {
        dir: {
            input: "src",
            output: "out",
        },
    };
}
