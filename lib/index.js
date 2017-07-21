'use strict';

var _sourceMapSupport2 = require('source-map-support');

(0, _sourceMapSupport2.install)();
var debug = require('debug')('metalsmith:migrate-safetag');
var minimatch = require('minimatch');
var _ = require('lodash');
var trimNewlines = require('trim-newlines');

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
      images = _ref$images === undefined ? false : _ref$images;

  return function (files, metalsmith, done) {
    // First pass reducer to group exercises files in one activity and prepare for transform pass.
    var walk = function walk(acc, file, key) {
      // Process activities.
      if (activities && minimatch(key, 'exercises/*/**.md')) {
        // Default to empty contents.
        var contents = { contents: new Buffer('') };

        // Get index content
        var index = minimatch(key, 'exercises/*/index.md') ? file.contents.toString() : null;

        // Sanity checks
        var fields = ['summary', 'approach', 'materials_needed', 'operational_security', 'instructions', 'recommendations'];

        var includes_regexp = /^!INCLUDE\s"(.*)\.md"/gm;

        var match = void 0;
        var matches = [];

        while (match = includes_regexp.exec(index)) {
          matches.push(match[1]);
        }matches.forEach(function (match) {
          if (!fields.includes(match)) console.warn('Unknown field ' + match + ' in file ' + key);
        });

        // Match title

        var title = index && index.match(/^####\s(.*)$/m) ? { title: index.match(/^####\s(.*)$/m)[1] } : null;

        // Add included files as metadata on activity object.

        var summary = minimatch(key, 'exercises/*/summary.md') ? { summary: trimNewlines(file.contents.toString()) } : null;

        var approach = minimatch(key, 'exercises/*/approach.md') ? { approach: trimNewlines(file.contents.toString()) } : null;
        var materials = minimatch(key, 'exercises/*/materials_needed.md') ? { materials: trimNewlines(file.contents.toString()) } : null;
        var opsec = minimatch(key, 'exercises/*/operational_security.md') ? { opsec: trimNewlines(file.contents.toString()) } : null;
        var instructions = minimatch(key, 'exercises/*/instructions.md') ? { instructions: trimNewlines(file.contents.toString()) } : null;
        var recommendations = minimatch(key, 'exercises/*/recommendations.md') ? { recommendations: trimNewlines(file.contents.toString()) } : null;

        var id = { id: key.split('exercises/')[1].split('/')[0].replace(/_/g, '-') };
        var activity = 'activities/' + id.id + '/index.md';

        // Assemble single activity file with metadata fields for second pass.
        return Object.assign({}, acc, {
          [activity]: Object.assign({}, acc[activity], id, contents, title, summary, approach, materials, opsec, instructions, recommendations)
        });
      } else if (methods && (minimatch(key, 'methods/*.md') || minimatch(key, 'methods/*/*.md'))) {
        // Replace transclusion links
        var _contents = file.contents.toString().replace(/^!INCLUDE "(.*)"\W?$/gm, ':[]($1)').replace(/\/exercises\//g, '/activities/');

        // Acivities are listed in index.guide.md
        // For now, instead of scraping it, reuse taxonomy in toolkit pipeline to display activity browser.

        // TODO:Sanity checks

        // Match title

        var _title = _contents && _contents.match(/^####\s(.*)$/m) ? { title: _contents.match(/^####\s(.*)$/m)[1] } : null;

        // Assemble single activity file with metadata fields for second pass.
        return Object.assign({}, acc, {
          [key]: Object.assign({}, file, {
            contents: new Buffer(_contents),
            id: key,
            title: _title,
            layout: 'method.md'
          })
        });
      } else if (references && minimatch(key, 'references/*.md')) {
        // TODO: Check external links and download for offline use.
        var _contents2 = file.contents.toString();

        // TODO:Sanity checks

        // Match title

        var _title2 = _contents2 && _contents2.match(/^####\s(.*)$/m) ? { title: _contents2.match(/^####\s(.*)$/m)[1] } : null;

        // Assemble single activity file with metadata fields for second pass.
        return Object.assign({}, acc, {
          [key]: Object.assign({}, file, {
            contents: new Buffer(_contents2),
            id: key,
            title: _title2,
            description: 'test',
            layout: 'reference.md'
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
      if (activities && key === 'activities/check-user-browser-vulns/index.md') {
        return Object.assign({}, file, {
          title: 'Check user browser vulnerabilities',
          description: 'Outdated Java browser plugins',
          contents: files['exercises/check_user_browser_vulns/browser_java_plugin.md'].contents
        });
      } else if (activities) {
        var description = file.summary ? trimNewlines(file.summary).substring(0, 120).replace(/^##(.*)$/m, '').replace(/\r?\n|\r/g, '').split(' ').slice(0, -1).join(' ') + '...' : file.title || '';
        debug('description', description);
        return Object.assign({}, file, { description });
      }
      return file;
    };

    var reduced = _.reduce(files, walk, {});
    var results = _.mapValues(reduced, transform);

    // Delete original files object.
    Object.keys(files).forEach(function (key) {
      delete files[key];
    });

    // Restore files object with migration results
    Object.keys(results).forEach(function (key) {
      files[key] = results[key];
    });

    done();
  };
}