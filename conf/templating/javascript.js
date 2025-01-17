import textInject from "../../utils/text-inject.js";

function evalInContext(js, context) {
    return function () {
        return eval(js);
    }.call(context);
}

/** @param {import("@11ty/eleventy").UserConfig} eleventyConfig */
export default function javascript(eleventyConfig) {
    eleventyConfig.addTemplateFormats("ts");
    eleventyConfig.addExtension("ts", {
        outputFileExtension: "js",
        // @ts-ignore
        compile: async function (inputContent, inputPath) {
            return async (data) => {
                let result = (
                    await (
                        await import("esbuild")
                    ).build({
                        entryPoints: [inputPath],
                        define: {},
                        //format: "esm",
                        platform: "browser",
                        minify: false, // process.env.NODE_ENV === "production",
                        bundle: true,
                        write: false,
                    })
                ).outputFiles[0].text;
                if (process.env.ELEVENTY_ENV === "production") {
                    // @ts-ignore
                    result = (
                        await (
                            await import("terser")
                        ).minify(result, {
                            module: true,
                            ecma: 2017,
                            compress: {
                                booleans_as_integers: true,
                                unsafe: true,
                                unsafe_math: true,
                            },
                        })
                    ).code;
                }
                return textInject(result).replaceAll(
                    /{{{(.*?)}}}/g,
                    (...match) => evalInContext(match[1], data),
                );
            };
        },
        compileOptions: {
            permalink: function (contents, inputPath) {
                return inputPath
                    .replace("src/scripts/", "")
                    .replace("ts", "js");
            },
        },
    });
}
