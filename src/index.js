const debug = require('debug')('metalsmith:migrate-safetag');
const minimatch = require('minimatch');
const _ = require('lodash');
const trimNewlines = require('trim-newlines');
const fs = require('fs');
const path = require('path');

/**
 * Expose `plugin`.
 */

module.exports = plugin;

/**
 * Metalsmith plugin to migrate SAFETAG content to the metalsmith approach.
 *
 *
 * @param {Object} options
 * @param {boolean} options.activities Migrate activities.
 *
 * @return {Function}
 */

function plugin(options) {
  const {
    activities = false,
    methods = false,
    references = false,
    images = false,
    document_matter = false,
    origin,
    origin_path_prefix
  } =
    options || {};

  return function(files, metalsmith, done) {
    // First pass reducer to group exercises files in one activity and prepare for transform pass.
    const walk = (acc, file, key) => {
      // Process activities.
      if (activities && minimatch(key, 'exercises/*/**.md')) {
        // Default to empty contents.
        const contents = { contents: new Buffer('') };

        // Get index content
        const index = minimatch(key, 'exercises/*/index.md') ? file.contents.toString() : null;

        // Sanity checks
        const fields = [
          'summary',
          'approach',
          'materials_needed',
          'operational_security',
          'instructions',
          'recommendations'
        ];

        const includes_regexp = /^!INCLUDE\s"(.*)\.md"/gm;

        let match;
        const matches = [];

        while ((match = includes_regexp.exec(index))) matches.push(match[1]);

        matches.forEach(match => {
          if (!fields.includes(match)) console.warn('Unknown field ' + match + ' in file ' + key);
        });

        // Match title

        const title = index && index.match(/^####\s(.*)$/m) ? { title: index.match(/^####\s(.*)$/m)[1] } : null;

        // Add included files as metadata on activity object.

        const summary = minimatch(key, 'exercises/*/summary.md')
          ? { summary: trimNewlines(file.contents.toString()) }
          : null;

        const approach = minimatch(key, 'exercises/*/approach.md')
          ? { approach: trimNewlines(file.contents.toString()) }
          : null;
        const materials = minimatch(key, 'exercises/*/materials_needed.md')
          ? { materials: trimNewlines(file.contents.toString()) }
          : null;
        const opsec = minimatch(key, 'exercises/*/operational_security.md')
          ? { opsec: trimNewlines(file.contents.toString()) }
          : null;
        const instructions = minimatch(key, 'exercises/*/instructions.md')
          ? { instructions: trimNewlines(file.contents.toString()) }
          : null;
        const recommendations = minimatch(key, 'exercises/*/recommendations.md')
          ? { recommendations: trimNewlines(file.contents.toString()) }
          : null;

        const id = {
          id: key.split('exercises/')[1].split('/')[0].replace(/_/g, '-')
        };
        const activity = 'activities/' + id.id + '.md';

        // Assemble single activity file with metadata fields for second pass.
        return {
          ...acc,
          [activity]: {
            ...acc[activity],
            ...id,
            ...contents,
            ...title,
            ...summary,
            ...approach,
            ...materials,
            ...opsec,
            ...instructions,
            ...recommendations,
            origin_path: origin_path_prefix + key
          }
        };
      } else if (methods && (minimatch(key, 'methods/*.md') || minimatch(key, 'methods/*/*.md'))) {
        // Replace transclusion links and remove Activities heading
        const contents = file.contents
          .toString()
          .replace(/^!INCLUDE "(.*)"\W?$/gm, ':[]($1)')
          .replace(/\/exercises\//g, '/activities/')
          .replace(/^### Activities.?$/gm, '');

        // Activities are listed in index.guide.md
        // For now, instead of scraping it, reuse taxonomy in toolkit pipeline to display activity browser.

        // Sanity check: Check if transclusion destinations exist.

        const transclusionRE = /\:\[\]\((.*)\)/gm;
        let destLinks;

        while ((destLinks = transclusionRE.exec(contents)) !== null) {
          // We skip activities as they are linked to methods via the taxonomy
          if (!destLinks[1].includes('/activities/')) {
            try {
              fs.openSync(path.join(metalsmith.source(), 'methods', destLinks[1]), fs.constants.O_RDONLY);
            } catch (e) {
              console.log(
                `Missing transclusion destination in ${key}:`,
                path.join(metalsmith.source(), 'methods', destLinks[1])
              );
            }
          }
        }

        // Match title

        const title =
          contents && contents.match(/^####\s(.*)$/m) ? { title: contents.match(/^####\s(.*)$/m)[1] } : null;

        // Assemble single activity file with metadata fields for second pass.
        return {
          ...acc,
          [key]: {
            ...file,
            contents: new Buffer(contents),
            id: key,
            ...title,
            layout: 'method.md',
            origin_path: origin_path_prefix + key
          }
        };
      } else if (document_matter && minimatch(key, 'document_matter/**/*.md')) {
        // Replace transclusion links
        const contents = file.contents.toString().replace(/^!INCLUDE "(.*)"\W?$/gm, ':[]($1)');

        // TODO:Sanity checks

        // Match title

        const title =
          contents && contents.match(/^####\s(.*)$/m) ? { title: contents.match(/^####\s(.*)$/m)[1] } : null;

        // Assemble single activity file with metadata fields for second pass.
        return {
          ...acc,
          [key]: {
            ...file,
            contents: new Buffer(contents),
            id: key,
            ...title,
            layout: 'page.md',
            origin_path: origin_path_prefix + key
          }
        };
      } else if (references && minimatch(key, 'references/*.md')) {
        // TODO: Check external links and download for offline use.
        const contents = file.contents.toString();

        // TODO:Sanity checks

        // Match title

        const title =
          contents && contents.match(/^####\s(.*)$/m) ? { title: contents.match(/^####\s(.*)$/m)[1] } : null;

        // Assemble single activity file with metadata fields for second pass.
        return {
          ...acc,
          [key]: {
            ...file,
            contents: new Buffer(contents),
            id: key,
            ...title,
            description: 'test',
            layout: 'reference.md',
            origin_path: origin_path_prefix + key
          }
        };
      } else if (images && minimatch(key, 'images/**/*.*')) {
        // Move images to methods folder for now.
        const move = 'methods/' + key;

        // TODO:Sanity checks

        // Assemble single activity file with metadata fields for second pass.
        return {
          ...acc,
          [move]: {
            ...file
          }
        };
      }
      return acc;
    };

    // Second pass transform.
    const transform = (file, key) => {
      // Deal with special cases
      if (activities && key === 'activities/check-user-browser-vulns.md') {
        return {
          ...file,
          title: 'Check user browser vulnerabilities',
          description: 'Outdated Java browser plugins',
          contents: files['exercises/check_user_browser_vulns/browser_java_plugin.md'].contents,
          origin
        };
      } else if (activities) {
        const description = file.summary
          ? trimNewlines(file.summary)
              .substring(0, 120)
              .replace(/^##(.*)$/m, '')
              .replace(/\r?\n|\r/g, '')
              .split(' ')
              .slice(0, -1)
              .join(' ') + '...'
          : file.title || '';
        debug('description', description);

        // Add footnotes file to all activities (only the used ones will be displayed by pandoc)

        const footnotes = files['references/footnotes.md'].contents.toString();

        return {
          ...file,
          description,
          origin,
          footnotes
        };
      }
      return { ...file, origin };
    };

    const reduced = _.reduce(files, walk, {});
    const results = _.mapValues(reduced, transform);

    // Delete original files object.
    Object.keys(files).forEach(key => {
      delete files[key];
    });

    // Restore files object with migration results
    // And add origin metatag for upstream edit link
    Object.keys(results).forEach(key => {
      files[key] = { ...results[key] };
    });

    done();
  };
}
