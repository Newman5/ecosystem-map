module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/css": "css" });
  eleventyConfig.addPassthroughCopy({ "src/js": "js" });
  eleventyConfig.addPassthroughCopy({ "data": "data" });
  eleventyConfig.addPassthroughCopy({ "node_modules/leaflet/dist": "vendor/leaflet" });
  eleventyConfig.addPassthroughCopy({ "node_modules/georaster/dist": "vendor/georaster" });
  eleventyConfig.addPassthroughCopy({ "node_modules/georaster-layer-for-leaflet/dist": "vendor/georaster-layer-for-leaflet" });
  eleventyConfig.addFilter("json", (value) => JSON.stringify(value));

  return {
    dir: {
      input: "src",
      includes: "_includes",
      data: "_data",
      output: "_site",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
};
