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
    guides = false,
    origin,
    origin_path_prefix
  } =
    options || {};

  return function(files, metalsmith, done) {
    //

    // First pass reducer to group exercises files in one activity and prepare for transform pass.
    const walk = (acc, file, key) => {
      // Process activities.
      if (activities && minimatch(key, 'exercises/*/**.md')) {
        // Default to empty contents.
        const contents = { contents: new Buffer('') };

        // Get index content
        const index = minimatch(key, 'exercises/*/index.md') ? file.contents.toString() : null;

        // Sanity check: Verify that activity index structure is as expected
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
          if (!fields.includes(match))
            console.warn('Unexpected transclusion ' + match + ' in activity index file ' + key);
        });

        // Match title

        const title = index && index.match(/^####\s(.*)$/m) ? { title: index.match(/^####\s(.*)$/m)[1] } : null;

        const processTransclusions = str => trimNewlines(str.toString().replace(includes_regexp, ':[]($1.md)'));

        // Sanity check: Check if transclusion destinations exist.

        const transclusionRE = /:\[\]\((.*)\)/gm;
        let destLinks;

        while ((destLinks = transclusionRE.exec(processTransclusions(file.contents))) !== null) {
          try {
            fs.openSync(
              path.join(metalsmith.source(), 'exercises', key.split('exercises/')[1].split('/')[0], destLinks[1]),
              fs.constants.O_RDONLY
            );
          } catch (e) {
            console.log(
              `Missing transclusion destination in ${key}:`,
              path.join(metalsmith.source(), 'exercises', key.split('exercises/')[1].split('/')[0], destLinks[1])
            );
          }
        }

        // Add included files as metadata on activity object.

        const summary = minimatch(key, 'exercises/*/summary.md')
          ? { summary: processTransclusions(file.contents) }
          : null;

        const approach = minimatch(key, 'exercises/*/approach.md')
          ? { approach: processTransclusions(file.contents) }
          : null;
        const materials = minimatch(key, 'exercises/*/materials_needed.md')
          ? { materials: processTransclusions(file.contents) }
          : null;
        const opsec = minimatch(key, 'exercises/*/operational_security.md')
          ? { opsec: processTransclusions(file.contents) }
          : null;
        const instructions = minimatch(key, 'exercises/*/instructions.md')
          ? { instructions: processTransclusions(file.contents) }
          : null;
        const recommendations = minimatch(key, 'exercises/*/recommendations.md')
          ? { recommendations: processTransclusions(file.contents) }
          : null;

        const id = {
          id: key
            .split('exercises/')[1]
            .split('/')[0]
            .replace(/_/g, '-')
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
          .replace(/\/exercises\//g, '/activities/');

        // Activities are listed in index.guide.md
        // For now, instead of scraping it, reuse taxonomy in toolkit pipeline to display activity browser.

        // Sanity check: Check if transclusion destinations exist.

        const transclusionRE = /:\[\]\((.*)\)/gm;
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
        // Create ${method}.md file as target for toolkit display and leave ${method}.guide.md for guide preview.
        return {
          ...acc,
          [key.replace('.guide.md', '.md')]: {
            ...file,
            contents: new Buffer(contents.replace(/^### Activities.?$/gm, '')),
            id: key.replace('.guide.md', '.md'),
            ...title,
            layout: 'method.md',
            origin_path: origin_path_prefix + key
          },
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
        // const move = 'methods/' + key;

        // TODO:Sanity checks

        // Assemble single activity file with metadata fields for second pass.
        return {
          ...acc,
          [key]: {
            ...file
          }
        };
      } else if (guides && minimatch(key, 'index.guide.md')) {
        // Move guide to guides/index.md.
        const move = 'index.guide.md';

        const contents = file.contents
          .toString()
          .replace(/^!INCLUDE "(.*)"\W?$/gm, ':[](./$1)')
          .replace(
            /:\[\]\(\.\/exercises\/(.*)\/index\.md\)/g,
            (_, slug) => ':[](./activities/' + slug.replace(/_/g, '-') + '.md)'
          );

        // TODO:Sanity checks

        // Assemble single activity file with metadata fields for second pass.
        return {
          ...acc,
          [move]: {
            ...file,
            contents: new Buffer(contents),
            layout: 'guide.md',
            origin_path: origin_path_prefix + key
          }
        };
      }
      return acc;
    };

    // Second pass transform.
    const transform = (file, key) => {
      // Deal with special cases

      // Add footnotes file to all remaining files (only the used ones will be displayed by pandoc)
      const footnotes = null; //':[](../references/footnotes.md)';

      if (activities && key === 'activities/check-user-browser-vulns.md') {
        return {
          ...file,
          title: 'Check user browser vulnerabilities',
          description: 'Outdated Java browser plugins',
          special: files['exercises/check_user_browser_vulns/browser_java_plugin.md'].contents.toString(),
          origin,
          footnotes
        };
      } else if (activities && minimatch(key, 'activities/**/*.md')) {
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

        return {
          ...file,
          description,
          origin,
          footnotes
        };
      } else if (methods && minimatch(key, 'methods/*.md')) {
        // console.log('method.match', key);
        // Add footnotes only on transcluding file.
        return {
          ...file,
          origin,
          footnotes
        };
      }
      return {
        ...file,
        origin
      };
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
