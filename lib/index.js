'use strict';

var _sourceMapSupport2 = require('source-map-support');

(0, _sourceMapSupport2.install)();
var debug = require('debug')('metalsmith:migrate-safetag');
var minimatch = require('minimatch');
var _ = require('lodash');
var trimNewlines = require('trim-newlines');
var fs = require('fs');
var path = require('path');

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
  var _ref = options || {},
      _ref$activities = _ref.activities,
      activities = _ref$activities === undefined ? false : _ref$activities,
      _ref$methods = _ref.methods,
      methods = _ref$methods === undefined ? false : _ref$methods,
      _ref$references = _ref.references,
      references = _ref$references === undefined ? false : _ref$references,
      _ref$images = _ref.images,
      images = _ref$images === undefined ? false : _ref$images,
      _ref$document_matter = _ref.document_matter,
      document_matter = _ref$document_matter === undefined ? false : _ref$document_matter,
      origin = _ref.origin,
      origin_path_prefix = _ref.origin_path_prefix;

  return function (files, metalsmith, done) {
    // First pass reducer to group exercises files in one activity and prepare for transform pass.
    var walk = function walk(acc, file, key) {
      // Process activities.
      if (activities && minimatch(key, 'exercises/*/**.md')) {
        // Default to empty contents.
        var contents = { contents: new Buffer('') };

        // Get index content
        var index = minimatch(key, 'exercises/*/index.md') ? file.contents.toString() : null;

        // Sanity check: Verify that activity index structure is as expected
        var fields = ['summary', 'approach', 'materials_needed', 'operational_security', 'instructions', 'recommendations'];

        var includes_regexp = /^!INCLUDE\s"(.*)\.md"/gm;

        var match = void 0;
        var matches = [];

        while (match = includes_regexp.exec(index)) {
          matches.push(match[1]);
        }matches.forEach(function (match) {
          if (!fields.includes(match)) console.warn('Unexpected transclusion ' + match + ' in activity index file ' + key);
        });

        // Match title

        var title = index && index.match(/^####\s(.*)$/m) ? { title: index.match(/^####\s(.*)$/m)[1] } : null;

        var processTransclusions = function processTransclusions(str) {
          return trimNewlines(str.toString().replace(includes_regexp, ':[]($1.md)'));
        };

        // Sanity check: Check if transclusion destinations exist.

        var transclusionRE = /\:\[\]\((.*)\)/gm;
        var destLinks = void 0;

        while ((destLinks = transclusionRE.exec(processTransclusions(file.contents))) !== null) {
          try {
            fs.openSync(path.join(metalsmith.source(), 'exercises', key.split('exercises/')[1].split('/')[0], destLinks[1]), fs.constants.O_RDONLY);
          } catch (e) {
            console.log(`Missing transclusion destination in ${key}:`, path.join(metalsmith.source(), 'exercises', key.split('exercises/')[1].split('/')[0], destLinks[1]));
          }
        }

        // Add included files as metadata on activity object.

        var summary = minimatch(key, 'exercises/*/summary.md') ? { summary: processTransclusions(file.contents) } : null;

        var approach = minimatch(key, 'exercises/*/approach.md') ? { approach: processTransclusions(file.contents) } : null;
        var materials = minimatch(key, 'exercises/*/materials_needed.md') ? { materials: processTransclusions(file.contents) } : null;
        var opsec = minimatch(key, 'exercises/*/operational_security.md') ? { opsec: processTransclusions(file.contents) } : null;
        var instructions = minimatch(key, 'exercises/*/instructions.md') ? { instructions: processTransclusions(file.contents) } : null;
        var recommendations = minimatch(key, 'exercises/*/recommendations.md') ? { recommendations: processTransclusions(file.contents) } : null;

        var id = {
          id: key.split('exercises/')[1].split('/')[0].replace(/_/g, '-')
        };
        var activity = 'activities/' + id.id + '.md';

        // Assemble single activity file with metadata fields for second pass.
        return Object.assign({}, acc, {
          [activity]: Object.assign({}, acc[activity], id, contents, title, summary, approach, materials, opsec, instructions, recommendations, {
            origin_path: origin_path_prefix + key
          })
        });
      } else if (methods && (minimatch(key, 'methods/*.md') || minimatch(key, 'methods/*/*.md'))) {
        // Replace transclusion links and remove Activities heading
        var _contents = file.contents.toString().replace(/^!INCLUDE "(.*)"\W?$/gm, ':[]($1)').replace(/\/exercises\//g, '/activities/').replace(/^### Activities.?$/gm, '');

        // Activities are listed in index.guide.md
        // For now, instead of scraping it, reuse taxonomy in toolkit pipeline to display activity browser.

        // Sanity check: Check if transclusion destinations exist.

        var _transclusionRE = /\:\[\]\((.*)\)/gm;
        var _destLinks = void 0;

        while ((_destLinks = _transclusionRE.exec(_contents)) !== null) {
          // We skip activities as they are linked to methods via the taxonomy
          if (!_destLinks[1].includes('/activities/')) {
            try {
              fs.openSync(path.join(metalsmith.source(), 'methods', _destLinks[1]), fs.constants.O_RDONLY);
            } catch (e) {
              console.log(`Missing transclusion destination in ${key}:`, path.join(metalsmith.source(), 'methods', _destLinks[1]));
            }
          }
        }

        // Match title

        var _title = _contents && _contents.match(/^####\s(.*)$/m) ? { title: _contents.match(/^####\s(.*)$/m)[1] } : null;

        // Assemble single activity file with metadata fields for second pass.
        return Object.assign({}, acc, {
          [key]: Object.assign({}, file, {
            contents: new Buffer(_contents),
            id: key
          }, _title, {
            layout: 'method.md',
            origin_path: origin_path_prefix + key
          })
        });
      } else if (document_matter && minimatch(key, 'document_matter/**/*.md')) {
        // Replace transclusion links
        var _contents2 = file.contents.toString().replace(/^!INCLUDE "(.*)"\W?$/gm, ':[]($1)');

        // TODO:Sanity checks

        // Match title

        var _title2 = _contents2 && _contents2.match(/^####\s(.*)$/m) ? { title: _contents2.match(/^####\s(.*)$/m)[1] } : null;

        // Assemble single activity file with metadata fields for second pass.
        return Object.assign({}, acc, {
          [key]: Object.assign({}, file, {
            contents: new Buffer(_contents2),
            id: key
          }, _title2, {
            layout: 'page.md',
            origin_path: origin_path_prefix + key
          })
        });
      } else if (references && minimatch(key, 'references/*.md')) {
        // TODO: Check external links and download for offline use.
        var _contents3 = file.contents.toString();

        // TODO:Sanity checks

        // Match title

        var _title3 = _contents3 && _contents3.match(/^####\s(.*)$/m) ? { title: _contents3.match(/^####\s(.*)$/m)[1] } : null;

        // Assemble single activity file with metadata fields for second pass.
        return Object.assign({}, acc, {
          [key]: Object.assign({}, file, {
            contents: new Buffer(_contents3),
            id: key
          }, _title3, {
            description: 'test',
            layout: 'reference.md',
            origin_path: origin_path_prefix + key
          })
        });
      } else if (images && minimatch(key, 'images/**/*.*')) {
        // Move images to methods folder for now.
        var move = 'methods/' + key;

        // TODO:Sanity checks

        // Assemble single activity file with metadata fields for second pass.
        return Object.assign({}, acc, {
          [move]: Object.assign({}, file)
        });
      }
      return acc;
    };

    // Second pass transform.
    var transform = function transform(file, key) {
      // Deal with special cases
      if (activities && key === 'activities/check-user-browser-vulns.md') {
        return Object.assign({}, file, {
          title: 'Check user browser vulnerabilities',
          description: 'Outdated Java browser plugins',
          special: files['exercises/check_user_browser_vulns/browser_java_plugin.md'].contents.toString(),
          origin
        });
      } else if (activities) {
        var description = file.summary ? trimNewlines(file.summary).substring(0, 120).replace(/^##(.*)$/m, '').replace(/\r?\n|\r/g, '').split(' ').slice(0, -1).join(' ') + '...' : file.title || '';
        debug('description', description);

        // Add footnotes file to all activities (only the used ones will be displayed by pandoc)

        var footnotes = files['references/footnotes.md'].contents.toString();

        return Object.assign({}, file, {
          description,
          origin,
          footnotes
        });
      }
      return Object.assign({}, file, { origin });
    };

    var reduced = _.reduce(files, walk, {});
    var results = _.mapValues(reduced, transform);

    // Delete original files object.
    Object.keys(files).forEach(function (key) {
      delete files[key];
    });

    // Restore files object with migration results
    // And add origin metatag for upstream edit link
    Object.keys(results).forEach(function (key) {
      files[key] = Object.assign({}, results[key]);
    });

    done();
  };
}