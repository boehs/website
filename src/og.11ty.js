export default class Og {
    data() {
        return {
            pagination: {
                size: 1,
                data: "collections.ogReady",
                alias: "entry",
            },
            eleventyExcludeFromCollections: true,
            mdTemplateEngine: false,
            htmlTemplateEngine: false,
            eleventyComputed: {
                permalink: (ctx) => {
                    return (
                        "og" +
                        ctx.entry.outputPath
                            .replace(".html", ".png")
                            .replace("./out", "")
                    );
                },
            },
        };
    }
    async render(page) {
        let svgd = await (
            await import("../utils/ogHelpers.js")
        ).svg({
            title: page.entry.data.title,
            desc: page.entry.data.description,
            date: page.entry.data.date?.toLocaleDateString(),
            color: page.entry.data.color,
        });
        return renderSvg(svgd);
    }
}

async function renderSvg(svgd) {
    /**
     * @type {import("@resvg/resvg-js").ResvgRenderOptions}
     */
    const options = {
        font: {
            loadSystemFonts: false,
        },
    };
    const png = new (await import("@resvg/resvg-js")).Resvg(svgd, options)
        .render()
        .asPng();
    return png;
}
